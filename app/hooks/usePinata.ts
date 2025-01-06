// hooks/usePinata.ts
import { useState, useEffect, useCallback } from 'react';
import { PinataSDK } from 'pinata-web3';


const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT
const PINATA_GW =process.env.NEXT_PUBLIC_PINATA_GW

console.log("PINATA_JWT",PINATA_JWT)
console.log("PINATA_GW",PINATA_GW)

// 初始化 Pinata 客户端（全局只实例化一次）
const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT,
  pinataGateway: PINATA_GW,
});

// 定义 Pinata 文件列表项的类型
interface PinataFile {
  ipfs_pin_hash: string;
  date_pinned: string;
}

// 定义 Pinata 文件上传返回类型
interface PinataUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  PinataUrl?: string; // 可选，是否返回网关访问 URL
}

export const usePinata = (limit: number = 8) => {
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ipfsHash, setIpfsHash] = useState<string | null>(null);

  // 查询最新文件 CID 列表
  const getLatestCIDs = useCallback(
    async (pageLimit: number = limit) => {
      setLoading(true);
      setError(null);

      try {
        const files: PinataFile[] = await pinata.listFiles().pageLimit(100);
        const sortedFiles = files.sort((a, b) => {
          const dateA = new Date(a.date_pinned).getTime();
          const dateB = new Date(b.date_pinned).getTime();
          return dateB - dateA; // 按时间倒序排序
        });

        const latestCIDs = sortedFiles.slice(0, pageLimit).map(file => file.ipfs_pin_hash);
        setVideoIds(latestCIDs);
      } catch (err) {
        console.error('Error fetching latest files:', err);
        setError('获取文件失败，请稍后重试！');
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  // 上传文件到 Pinata
  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const upload = pinata.upload.file(file); // 创建上传任务
      const result: PinataUploadResponse = await upload; // 上传并解析返回结果

      console.log('上传结果:', result);
      setIpfsHash(result.IpfsHash); // 设置文件的 IPFS Hash（CID）

      // 上传成功后刷新文件列表
      await getLatestCIDs();
    } catch (err) {
      console.error('Error uploading file to Pinata:', err);
      setError('上传文件失败，请重试！');
    } finally {
      setUploading(false);
    }
  };

  // 初始化时加载最新文件
  useEffect(() => {
    getLatestCIDs();
  }, [getLatestCIDs]);

  return {
    videoIds,  // 最新视频文件 CID 列表
    loading,   // 文件列表加载状态
    error,     // 错误信息
    uploadFile, // 上传文件方法
    uploading, // 文件上传状态
    ipfsHash,  // 上传文件的 IPFS CID
  };
};
