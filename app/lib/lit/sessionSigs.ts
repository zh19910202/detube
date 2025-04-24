import { getLitClient } from './litClient'
import {
  createSiweMessage,
  generateAuthSig,
  LitAccessControlConditionResource,
} from '@lit-protocol/auth-helpers'
import type { AccessControlConditions } from '@lit-protocol/types'
import { LIT_ABILITY } from '@lit-protocol/constants'
import { ethers } from 'ethers'

export const getSessionSigs = async (
  accessControlConditions: AccessControlConditions,
  dataToEncryptHash: string,
  ethersWallet: string,
  walletWithProvider: ethers.Wallet | ethers.Signer
) => {
  try {
    
    const client = await getLitClient()
    const resourceString = await LitAccessControlConditionResource.generateResourceString(
      accessControlConditions,
      dataToEncryptHash
    )
    console.log('🔐 生成的 resourceString:', resourceString)

    const sessionSigs = await client.getSessionSigs({
      chain: 'ethereum',
      expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
      resourceAbilityRequests: [
        {
          resource: new LitAccessControlConditionResource(resourceString),
          ability: LIT_ABILITY.AccessControlConditionDecryption,
        },
      ],
      authNeededCallback: async ({
        uri,
        expiration,
        resourceAbilityRequests,
      }) => {
        console.log('🔑 authNeededCallback 被触发')
        const toSign = await createSiweMessage({
          uri,
          expiration,
          resources: resourceAbilityRequests,
          walletAddress: ethersWallet,
          nonce: await client.getLatestBlockhash(),
          litNodeClient: client,
        })

        console.log('📝 SIWE 待签名内容:', toSign)

        const authSig = await generateAuthSig({
          signer: walletWithProvider,
          toSign,
        })

        console.log('✅ 已生成 AuthSig:', authSig)
        return authSig
      },
    })

    console.log('✅ 获取的 sessionSigs:', sessionSigs)
    return sessionSigs
  } catch (error) {
    console.error('❌ 获取 sessionSigs 失败:', error)
    throw error
  }
}
