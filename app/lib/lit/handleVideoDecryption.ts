// app/lib/lit/handleVideoDecryption.ts
import { ethers } from 'ethers'
import { decryptVideo } from './decrypt'
import { getSessionSigs } from './sessionSigs'
import { accessControlConditions } from './accessControl'

/**
 * 处理加密视频的解密
 * @param metadata 视频元数据
 * @param ethersWallet 用户钱包地址
 * @param walletWithProvider 用户钱包提供者
 * @returns 解密后的视频文件或null
 */
export const handleVideoDecryption = async (
  dataToEncryptHash: string,
  ciphertext: string,
  ethersWallet: string,
  walletWithProvider: ethers.Wallet | ethers.Signer
): Promise<File | null> => {
  try {
    console.log('开始解密视频...')

    // 使用accessControl.ts中定义的访问控制条件
    // 这里使用特定的以太坊地址作为访问控制条件
    // 添加类型断言确保类型兼容

    // 获取会话签名
    const sigs = await getSessionSigs(
      accessControlConditions(ethersWallet),
      dataToEncryptHash,
      ethersWallet,
      walletWithProvider
    )

    //
    console.log('sigs', sigs)
    // 解密视频
    const decryptedFile = await decryptVideo(
      ciphertext,
      accessControlConditions(ethersWallet),
      dataToEncryptHash,
      sigs
    )

    console.log('视频解密成功')
    return decryptedFile
  } catch (error) {
    console.error('视频解密失败:', error)
    throw new Error(
      `视频解密失败: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
