import { encryptFile } from '@lit-protocol/encryption'
import { getLitClient } from './litClient'
import type { AccessControlConditions } from '@lit-protocol/types'
import { toByteArray } from 'base64-js'

export interface EncryptResponse {
  ciphertext: string
  dataToEncryptHash: string
}

export const encryptVideo = async (
  file: File,
  accessControlConditions: AccessControlConditions,
  chain: string = process.env.NEXT_PUBLIC_LIT_CHAIN || 'ethereum'
): Promise<{ dataToEncryptHash: string; newFile: File }> => {
  try {
    // 检查浏览器环境和 WebCrypto 支持
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('浏览器不支持 WebCrypto API，请使用现代浏览器并确保 HTTPS')
    }

    // 获取 Lit 客户端
    const litClient = await getLitClient()
    if (!litClient) {
      throw new Error('Lit 客户端未初始化')
    }

    // 验证输入
    if (!file || !(file instanceof File) || file.size === 0) {
      throw new Error('无效的文件：需要非空的 File 对象')
    }
    if (
      !accessControlConditions ||
      !Array.isArray(accessControlConditions) ||
      accessControlConditions.length === 0
    ) {
      throw new Error('无效的访问控制条件：需要非空数组')
    }
    const MAX_FILE_SIZE = 1_000_000_000 // 1GB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`文件过大，最大支持 ${MAX_FILE_SIZE / 1_000_000}MB`)
    }

    // 验证文件内容
    const arrayBuffer = await file.arrayBuffer()
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('文件内容为空')
    }

    // 执行加密
    const { ciphertext, dataToEncryptHash }: EncryptResponse = await encryptFile(
      {
        chain,
        accessControlConditions,
        file,
      },
      litClient
    )

    // 处理 Base64 编码的密文
    console.log('ciphertext1:', ciphertext)
    const uint8Array = toByteArray(ciphertext)
    const blob = new Blob([uint8Array], { type: 'application/octet-stream' })
    console.log('运行环境: 浏览器')
    console.log('ciphertext 长度:', blob.size)
    console.log('dataToEncryptHash:', dataToEncryptHash)
    console.log('加密成功')

    // 创建加密文件
    const fileName = `${file.name}.encrypted`
    const fileType = file.type || 'application/octet-stream'
    const newFile = new File([blob], fileName, { type: fileType })

    return {
      dataToEncryptHash,
      newFile,
    }
  } catch (error) {
    console.error('加密失败:', error)
    const message = error instanceof Error
      ? `加密失败: ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`
      : `加密失败: ${String(error)}`
    throw new Error(message)
  }
}