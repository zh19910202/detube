// app/lib/lit/decrypt.ts
import { decryptToFile } from '@lit-protocol/encryption'

import type {
  AccessControlConditions,
  SessionSigsMap,
} from '@lit-protocol/types'

import { getLitClient } from './litClient'

export const decryptVideo = async (
  ciphertext: string,
  accessControlConditions: AccessControlConditions,
  dataToEncryptHash: string,
  sessionSigs: SessionSigsMap
) => {
  try {
    const litClient = await getLitClient()
    // 解密文件
    const decryptedFile = await decryptToFile(
      {
        chain: 'ethereum',
        ciphertext,
        dataToEncryptHash,
        accessControlConditions,
        sessionSigs,
      },
      litClient
    )
    const newFile: File = new File(
      [Buffer.from(decryptedFile)],
      'encrypted-file.mp4',
      { type: 'application/octet-stream' }
    )
    return newFile
  } catch (error) {
    console.error('解密失败:', error)
    throw new Error(
      `解密失败: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
