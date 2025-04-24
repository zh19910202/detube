// app/lib/lit/accessControl.ts

// 基本以太坊地址访问控制条件
export const accessControlConditions = [
  {
    contractAddress: '',
    standardContractType: '',
    chain: 'ethereum',
    method: '',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '=',
      value: '0x7073f449406B2BB7A7B68AB5EDA6546e429546D3',
    },
  },
]

// ERC721 NFT持有验证示例
export const nftAccessControlConditions = [
  {
    contractAddress: '0x...', // NFT合约地址
    standardContractType: 'ERC721',
    chain: 'ethereum',
    method: 'balanceOf',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '>',
      value: '0', // 持有至少1个NFT
    },
  },
]

// ERC1155 NFT持有验证示例
export const erc1155AccessControlConditions = [
  {
    contractAddress: '0x...', // ERC1155合约地址
    standardContractType: 'ERC1155',
    chain: 'ethereum',
    method: 'balanceOf',
    parameters: [':userAddress', '1'], // 1是token ID
    returnValueTest: {
      comparator: '>',
      value: '0', // 持有至少1个指定token
    },
  },
]

// ERC20 Token余额验证示例
export const tokenBalanceAccessControlConditions = [
  {
    contractAddress: '0x...', // ERC20合约地址
    standardContractType: 'ERC20',
    chain: 'ethereum',
    method: 'balanceOf',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '>=',
      value: '1000000000000000000', // 持有至少1个token (18位小数)
    },
  },
]

// 自定义智能合约方法验证示例
export const customContractAccessControlConditions = [
  {
    contractAddress: '0x...', // 自定义合约地址
    standardContractType: 'CustomContract',
    chain: 'ethereum',
    method: 'hasAccess', // 自定义方法
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '=',
      value: 'true', // 方法返回true
    },
  },
]

// 多链支持示例 (Polygon)
export const polygonAccessControlConditions = [
  {
    contractAddress: '0x...', // Polygon上的合约地址
    standardContractType: 'ERC721',
    chain: 'polygon',
    method: 'balanceOf',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '>',
      value: '0',
    },
  },
]
