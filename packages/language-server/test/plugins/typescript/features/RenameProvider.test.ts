import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Position } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { RenameProviderImpl } from '../../../../src/plugins/typescript/features/RenameProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';

const testDir = path.join(__dirname, '..');

describe('RenameProvider', () => {
    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', 'rename', filename);
    }

    function getUri(filename: string) {
        return pathToUrl(getFullPath(filename));
    }

    async function setup() {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(testDir)],
            new LSConfigManager()
        );
        const provider = new RenameProviderImpl(lsAndTsDocResolver);
        const renameDoc1 = await openDoc('rename.svelte');
        const renameDoc2 = await openDoc('rename2.svelte');
        const renameDoc3 = await openDoc('rename3.svelte');
        const renameDoc4 = await openDoc('rename4.svelte');
        const renameDoc5 = await openDoc('rename5.svelte');
        const renameDoc6 = await openDoc('rename6.svelte');
        const renameDocIgnoreGenerated = await openDoc('rename-ignore-generated.svelte');
        return {
            provider,
            renameDoc1,
            renameDoc2,
            renameDoc3,
            renameDoc4,
            renameDoc5,
            renameDoc6,
            renameDocIgnoreGenerated,
            docManager
        };

        async function openDoc(filename: string) {
            const filePath = getFullPath(filename);
            const doc = docManager.openDocument(<any>{
                uri: pathToUrl(filePath),
                text: ts.sys.readFile(filePath) || ''
            });
            // Do this to make the file known to the ts language service
            await provider.rename(doc, Position.create(0, 0), '');
            return doc;
        }
    }

    it('should rename variable that is scoped to component only', async () => {
        const { provider, renameDoc1 } = await setup();
        const result = await provider.rename(renameDoc1, Position.create(2, 15), 'newName');

        assert.deepStrictEqual(result, {
            changes: {
                [getUri('rename.svelte')]: [
                    {
                        newText: 'newName',
                        range: {
                            start: {
                                character: 8,
                                line: 2
                            },
                            end: {
                                character: 17,
                                line: 2
                            }
                        }
                    },
                    {
                        newText: 'newName',
                        range: {
                            start: {
                                character: 1,
                                line: 5
                            },
                            end: {
                                character: 10,
                                line: 5
                            }
                        }
                    },
                    {
                        newText: 'newName',
                        range: {
                            start: {
                                character: 5,
                                line: 6
                            },
                            end: {
                                character: 14,
                                line: 6
                            }
                        }
                    },
                    {
                        newText: 'newName',
                        range: {
                            start: {
                                character: 8,
                                line: 8
                            },
                            end: {
                                character: 17,
                                line: 8
                            }
                        }
                    },
                    {
                        newText: 'newName',
                        range: {
                            start: {
                                character: 7,
                                line: 10
                            },
                            end: {
                                character: 16,
                                line: 10
                            }
                        }
                    },
                    {
                        newText: 'newName',
                        range: {
                            start: {
                                character: 15,
                                line: 12
                            },
                            end: {
                                character: 24,
                                line: 12
                            }
                        }
                    }
                ]
            }
        });
    });

    const expectedEditsForPropRename = {
        changes: {
            [getUri('rename.svelte')]: [
                {
                    newText: 'newName',
                    range: {
                        start: {
                            character: 15,
                            line: 1
                        },
                        end: {
                            character: 27,
                            line: 1
                        }
                    }
                },
                {
                    newText: 'newName',
                    range: {
                        start: {
                            character: 1,
                            line: 14
                        },
                        end: {
                            character: 13,
                            line: 14
                        }
                    }
                }
            ],
            [getUri('rename2.svelte')]: [
                {
                    newText: 'newName',
                    range: {
                        start: {
                            character: 8,
                            line: 5
                        },
                        end: {
                            character: 20,
                            line: 5
                        }
                    }
                }
            ]
        }
    };

    it('should do rename of prop of component A in component A', async () => {
        const { provider, renameDoc1 } = await setup();
        const result = await provider.rename(renameDoc1, Position.create(1, 25), 'newName');

        assert.deepStrictEqual(result, expectedEditsForPropRename);
    });

    // TODO this does not work right now, see `RenameProviderImpl.cannotRename` for more explanation
    // it('should do rename of prop of component A in component B', async () => {
    //     const { provider, renameDoc2 } = await setup();
    //     const result = await provider.rename(renameDoc2, Position.create(4, 10), 'newName');

    //     assert.deepStrictEqual(result, expectedEditsForPropRename);
    // });

    it('should do rename of prop without type of component A in component A', async () => {
        const { provider, renameDoc3 } = await setup();
        const result = await provider.rename(renameDoc3, Position.create(1, 25), 'newName');

        assert.deepStrictEqual(result, {
            changes: {
                [getUri('rename3.svelte')]: [
                    {
                        newText: 'newName',
                        range: {
                            start: {
                                character: 15,
                                line: 1
                            },
                            end: {
                                character: 33,
                                line: 1
                            }
                        }
                    }
                ],
                [getUri('rename2.svelte')]: [
                    {
                        newText: 'newName',
                        range: {
                            start: {
                                character: 9,
                                line: 6
                            },
                            end: {
                                character: 27,
                                line: 6
                            }
                        }
                    }
                ]
            }
        });
    });

    it('should do rename of svelte component', async () => {
        const { provider, renameDoc4 } = await setup();
        const result = await provider.rename(renameDoc4, Position.create(1, 12), 'ChildNew');

        assert.deepStrictEqual(result, {
            changes: {
                [getUri('rename4.svelte')]: [
                    {
                        newText: 'ChildNew',
                        range: {
                            start: {
                                line: 1,
                                character: 11
                            },
                            end: {
                                line: 1,
                                character: 16
                            }
                        }
                    },
                    {
                        newText: 'ChildNew',
                        range: {
                            start: {
                                line: 7,
                                character: 5
                            },
                            end: {
                                line: 7,
                                character: 10
                            }
                        }
                    },
                    {
                        newText: 'ChildNew',
                        range: {
                            start: {
                                line: 8,
                                character: 5
                            },
                            end: {
                                line: 8,
                                character: 10
                            }
                        }
                    }
                ]
            }
        });
    });

    describe('should allow rename of $store', () => {
        async function do$storeRename(pos: Position) {
            const { provider, renameDoc5 } = await setup();
            const result = await provider.rename(renameDoc5, pos, 'store1');

            assert.deepStrictEqual(result, {
                changes: {
                    [getUri('rename5.svelte')]: [
                        {
                            newText: 'store1',
                            range: {
                                start: {
                                    line: 1,
                                    character: 8
                                },
                                end: {
                                    line: 1,
                                    character: 13
                                }
                            }
                        },
                        {
                            newText: 'store1',
                            range: {
                                start: {
                                    line: 2,
                                    character: 5
                                },
                                end: {
                                    line: 2,
                                    character: 10
                                }
                            }
                        },
                        {
                            newText: 'store1',
                            range: {
                                start: {
                                    line: 3,
                                    character: 8
                                },
                                end: {
                                    line: 3,
                                    character: 13
                                }
                            }
                        },
                        {
                            newText: 'store1',
                            range: {
                                start: {
                                    line: 6,
                                    character: 2
                                },
                                end: {
                                    line: 6,
                                    character: 7
                                }
                            }
                        },
                        {
                            newText: 'store1',
                            range: {
                                start: {
                                    line: 7,
                                    character: 6
                                },
                                end: {
                                    line: 7,
                                    character: 11
                                }
                            }
                        }
                    ]
                }
            });
        }

        it('from definition', async () => {
            await do$storeRename(Position.create(1, 10));
        });

        it('from usage within script', async () => {
            await do$storeRename(Position.create(3, 10));
        });
    });

    it('should allow rename of variable', async () => {
        const { provider, renameDoc1 } = await setup();
        const result = await provider.prepareRename(renameDoc1, Position.create(1, 25));

        assert.deepStrictEqual(result, {
            start: {
                character: 15,
                line: 1
            },
            end: {
                character: 27,
                line: 1
            }
        });
    });

    it('should not allow rename of html element', async () => {
        const { provider, renameDoc1 } = await setup();
        const result = await provider.prepareRename(renameDoc1, Position.create(12, 1));

        assert.deepStrictEqual(result, null);
    });

    it('should not allow rename of html attribute', async () => {
        const { provider, renameDoc1 } = await setup();
        const result = await provider.prepareRename(renameDoc1, Position.create(12, 5));

        assert.deepStrictEqual(result, null);
    });

    it('should rename with prefix', async () => {
        const { provider, renameDoc6 } = await setup();
        const result = await provider.rename(renameDoc6, Position.create(3, 9), 'newName');

        assert.deepStrictEqual(result, {
            changes: {
                [getUri('rename6.svelte')]: [
                    {
                        newText: 'newName',
                        range: {
                            start: {
                                character: 8,
                                line: 3
                            },
                            end: {
                                character: 11,
                                line: 3
                            }
                        }
                    },
                    {
                        newText: 'foo: newName',
                        range: {
                            start: {
                                character: 16,
                                line: 4
                            },
                            end: {
                                character: 19,
                                line: 4
                            }
                        }
                    },
                    {
                        newText: 'foo: newName',
                        range: {
                            start: {
                                character: 18,
                                line: 7
                            },
                            end: {
                                character: 21,
                                line: 7
                            }
                        }
                    }
                ]
            }
        });
    });

    it('should rename and ignore generated', async () => {
        const { provider, renameDocIgnoreGenerated } = await setup();
        const result = await provider.rename(
            renameDocIgnoreGenerated,
            Position.create(1, 8),
            'newName'
        );

        assert.deepStrictEqual(result, {
            changes: {
                [getUri('rename-ignore-generated.svelte')]: [
                    {
                        newText: 'newName',
                        range: {
                            end: {
                                character: 9,
                                line: 1
                            },
                            start: {
                                character: 8,
                                line: 1
                            }
                        }
                    },
                    {
                        newText: 'newName',
                        range: {
                            end: {
                                character: 6,
                                line: 5
                            },
                            start: {
                                character: 5,
                                line: 5
                            }
                        }
                    },
                    {
                        newText: 'newName',
                        range: {
                            end: {
                                character: 21,
                                line: 7
                            },
                            start: {
                                character: 20,
                                line: 7
                            }
                        }
                    }
                ]
            }
        });
    });
});
