// app/lib/lit/accessControl.ts
// import { EvmContractConditions } from '@lit-protocol/types'
// 自定义智能合约方法验证示例 - 使用正确的evmContractConditions格式
// export const  evmContractConditions: EvmContractConditions = [
//   {
//     contractAddress: '0x946F4b6EA3AD07Cd4eed93D1baD54Ac2c948e0C0',
//     functionName: 'hasRole',
//     functionParams: ['3', '0x2d7B3e18D45846DA09D78e3644F15BD4aafa634d'],
//     functionAbi: {
//       inputs: [
//         {
//           internalType: 'uint64',
//           name: 'roleId',
//           type: 'uint64',
//         },
//         {
//           internalType: 'address',
//           name: 'account',
//           type: 'address',
//         },
//       ],
//       name: 'hasRole',
//       outputs: [
//         {
//           internalType: 'bool',
//           name: 'isMember',
//           type: 'bool',
//         },
//         {
//           internalType: 'uint32',
//           name: 'executionDelay',
//           type: 'uint32',
//         },
//       ],
//       stateMutability: 'view',
//       type: 'function',
//     },
//     chain: 'sepolia',
//     returnValueTest: {
//       key: 'isMember',
//       comparator: '=',
//       value: 'true',
//     },
//   },
// ]

// 备注：此配置遵循Lit Protocol官方文档中的evmContractConditions格式
// 参考文档：https://developer.litprotocol.com/sdk/access-control/evm/custom-contract-calls
// 关键字段说明：
// - contractAddress: 合约地址
// - functionName: 要调用的合约方法名
// - functionParams: 传递给合约方法的参数，:userAddress为特殊占位符
// - functionAbi: 合约方法的ABI定义
// - chain: 区块链网络
// - returnValueTest: 定义访问控制条件的测试规则

export const accessControlConditions = (value: string) => {
  return [
    {
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':userAddress'],
      returnValueTest: {
        comparator: '=',
        value,
      },
    },
  ]
}
