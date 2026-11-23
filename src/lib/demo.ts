import type { IData } from '@lark-base-open/js-sdk';

const models = [
  '模型 A',
  '模型 B',
  '模型 C',
  '模型 D',
  '模型 E',
  '模型 F',
  '模型 G',
  '模型 H',
  '模型 I',
  '模型 J',
];

const accounts = [
  '账号 01',
  '账号 02',
  '账号 03',
  '账号 04',
  '账号 05',
  '账号 06',
  '账号 07',
  '账号 08',
  '账号 09',
  '账号 10',
];

const seed = [
  [118, 0, 4, 0, 0, 0, 0, 0, 0, 0],
  [4, 62, 0, 0, 0, 0, 0, 12, 0, 0],
  [0, 0, 37, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 5, 0, 28, 0, 0, 0, 0],
  [0, 0, 0, 0, 31, 0, 0, 0, 0, 0],
  [0, 21, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 14, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 9, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 16, 0],
  [0, 0, 0, 0, 0, 7, 0, 0, 0, 11],
];

export const mockMatrix: IData = [
  [
    { value: '模型 / 账号', text: '模型 / 账号' },
    ...accounts.map((account) => ({ value: account, text: account })),
  ],
  ...models.map((model, rowIndex) => [
    { value: model, text: model },
    ...seed[rowIndex].map((value) => ({ value, text: String(value) })),
  ]),
];
