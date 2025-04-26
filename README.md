# Detube 项目说明

Detube 是一个基于 IPFS + Lit Protocol 构建的去中心化 Web3 视频分享平台。  
用户可以上传公开或私有视频，并且支持观众通过 MetaMask 钱包直接打赏创作者。

---

## 项目背景

为了实现真正属于用户自己的内容平台，我们引入了：

- **IPFS**：永久存储视频，不依赖中心化服务器。
- **Lit Protocol**：设置访问控制，实现私有视频加密与解密。
- **智能合约（订阅系统）**：探索付费订阅功能，确保用户付费后才可观看特定内容。

通过设定 **AccessControlConditions**，可以只允许满足条件的用户（例如付费订阅用户）解密观看私有视频。

**注意**：  
虽然智能合约本身部署成功，调用逻辑正确，但在 Lit 协议中，基于自定义合约方法进行访问验证时，目前解密环节存在一定问题（**sessionSig 获取失败**）。  
此部分仍在进一步调试优化中，欢迎有经验的朋友交流分享！

---

## 演示说明

在当前版本的 Detube 演示中：

- **加密视频仅限上传者本人观看。**
- 上传者在上传视频时，系统会将钱包地址设置为唯一的访问控制条件（AccessControlConditions）。
- 其他钱包用户，即使知道视频的 IPFS 地址和 CID，也无法解密或播放加密的视频内容。
- 公共视频则不受限制，所有用户均可直接访问和播放。

### ⚡ 体验提示

如果你想测试加密视频访问权限，请确保：

- 使用**上传时连接的钱包地址**进行登录。
- 换用其他钱包地址重新连接，将无法查看加密视频。

这种设计保障了**内容隐私**和**用户所有权**，是 Detube 核心的去中心化理念体现。

---

## 快速开始体验 Detube

如果你想快速体验 Detube，或者搭建属于自己的 Web3 视频平台，请按照以下步骤：

### 前置条件

- 安装好 **MetaMask 钱包**。
- 注册一个 **Pinata 账号**（用于IPFS存储）。

### 本地运行

1. 克隆项目代码

    ```bash
    git clone https://github.com/zh19910202/detube.git
    cd detube
    ```

2. 安装依赖

    ```bash
    npm install
    ```

3. 配置环境变量

    在项目根目录创建 `.env.local` 文件，填写以下内容：

    ```env
    NEXT_PUBLIC_METADATA_GROUP_ID=
    NEXT_PUBLIC_PINATA_JWT=
    NEXT_PUBLIC_PINATA_GW=
    NEXT_PUBLIC_LIT_CHAIN=
    ```

4. 启动开发服务器

    ```bash
    npm run dev
    ```

5. 在浏览器中打开 [http://localhost:3000](http://localhost:3000)

6. 尝试上传你的第一个 Web3 视频吧！

---

## 未来规划

Detube 目前还是一个探索版，未来计划增加以下功能：

- ✅ 支持多链部署（Ethereum、Polygon、ZkSync等）
- ✅ 真正意义上的付费订阅机制
- ✅ 更加智能的视频内容推荐算法
- ✅ 优化视频播放体验，提升用户流畅度

---

## 贡献与交流

如果你也对 Web3 内容平台感兴趣，欢迎：

- Star 项目
- Fork 项目
- 提 Issue
- 提 Pull Request
- 直接留言交流想法！

让我们一起，用代码开辟属于自己的内容世界！

---

## 链接

- GitHub 仓库：[Detube 项目地址](https://github.com/zh19910202/detube)
- 在线演示：[Detube 在线体验](https://detube-eta.vercel.app/)

## ps
## 自定义合约调用失败说明

Detube 项目曾尝试通过 Lit Protocol 的 **EVM Contract Conditions（自定义合约访问控制）** 实现以下功能：

- 用户支付少量 ETH，订阅服务。
- 合约记录订阅状态，用户可通过验证订阅状态是否有效来解密私有视频。

对应智能合约示例：

```solidity
contract Subscription {
    function subscribe() external payable { ... }
    function isSubscriptionActive(address user) external view returns (bool) { ... }
}
``` 
```js
const evmContractConditions = [
  {
    contractAddress: '0xYourContractAddress',
    functionName: 'isSubscriptionActive',
    parameters: [':userAddress'],
    chain: 'sepolia',
    returnValueTest: {
      comparator: '=',
      value: 'true',
    },
  },
];
```
但是最终解密失败，如果你有尝试并成功欢迎告诉我！