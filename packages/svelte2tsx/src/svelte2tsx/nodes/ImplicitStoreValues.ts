import MagicString from 'magic-string';
import ts from 'typescript';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import { extractIdentifiers, getNamesFromLabeledStatement } from '../utils/tsAst';

/**
 * Tracks all store-usages as well as all variable declarations and imports in the component.
 *
 * In the modification-step at the end, all variable declartaions and imports which
 * were used as stores are appended with `let $xx = __sveltets_store_get(xx)` to create the store variables.
 */
export class ImplicitStoreValues {
    private accessedStores = new Set<string>();
    private variableDeclarations: ts.VariableDeclaration[] = [];
    private reactiveDeclarations: ts.LabeledStatement[] = [];
    private importStatements: Array<ts.ImportClause | ts.ImportSpecifier> = [];

    public addStoreAcess = this.accessedStores.add.bind(this.accessedStores);
    public addVariableDeclaration = this.variableDeclarations.push.bind(this.variableDeclarations);
    public addReactiveDeclaration = this.reactiveDeclarations.push.bind(this.reactiveDeclarations);
    public addImportStatement = this.importStatements.push.bind(this.importStatements);

    constructor(storesResolvedInTemplate: string[] = []) {
        storesResolvedInTemplate.forEach(this.addStoreAcess);
    }

    /**
     * All variable declartaions and imports which
     * were used as stores are appended with `let $xx = __sveltets_store_get(xx)` to create the store variables.
     */
    public modifyCode(astOffset: number, str: MagicString) {
        this.variableDeclarations.forEach((node) =>
            this.attachStoreValueDeclarationToDecl(node, astOffset, str)
        );

        this.reactiveDeclarations.forEach((node) =>
            this.attachStoreValueDeclarationToReactiveAssignment(node, astOffset, str)
        );

        this.importStatements
            .filter(({ name }) => name && this.accessedStores.has(name.getText()))
            .forEach((node) => this.attachStoreValueDeclarationToImport(node, astOffset, str));
    }

    public getAccessedStores(): string[] {
        return [...this.accessedStores.keys()];
    }

    private attachStoreValueDeclarationToDecl(
        node: ts.VariableDeclaration,
        astOffset: number,
        str: MagicString
    ) {
        const storeNames = extractIdentifiers(node.name)
            .map((id) => id.text)
            .filter((name) => this.accessedStores.has(name));
        if (!storeNames.length) {
            return;
        }

        const storeDeclarations = surroundWithIgnoreComments(
            this.createStoreDeclarations(storeNames)
        );
        const nodeEnd =
            ts.isVariableDeclarationList(node.parent) && node.parent.declarations.length > 1
                ? node.parent.declarations[node.parent.declarations.length - 1].getEnd()
                : node.getEnd();

        str.appendRight(nodeEnd + astOffset, storeDeclarations);
    }

    private attachStoreValueDeclarationToReactiveAssignment(
        node: ts.LabeledStatement,
        astOffset: number,
        str: MagicString
    ) {
        const storeNames = getNamesFromLabeledStatement(node).filter((name) =>
            this.accessedStores.has(name)
        );
        if (!storeNames.length) {
            return;
        }

        const storeDeclarations = surroundWithIgnoreComments(
            this.createStoreDeclarations(storeNames)
        );
        const endPos = node.getEnd() + astOffset;

        str.appendRight(endPos, storeDeclarations);
    }

    private attachStoreValueDeclarationToImport(
        node: ts.ImportClause | ts.ImportSpecifier,
        astOffset: number,
        str: MagicString
    ) {
        const storeName = node.name.getText();
        const storeDeclaration = surroundWithIgnoreComments(this.createStoreDeclaration(storeName));
        const importStatement = ts.isImportClause(node) ? node.parent : node.parent.parent.parent;
        const endPos = importStatement.getEnd() + astOffset;

        str.appendRight(endPos, storeDeclaration);
    }

    private createStoreDeclarations(storeNames: string[]): string {
        let declarations = '';
        for (let i = 0; i < storeNames.length; i++) {
            declarations += this.createStoreDeclaration(storeNames[i]);
        }
        return declarations;
    }

    private createStoreDeclaration(storeName: string): string {
        return `;let $${storeName} = __sveltets_store_get(${storeName});`;
    }
}
