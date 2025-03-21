'use client'
import { Inter } from 'next/font/google'
import './globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import Navbar from './components/Navbar'
import React, { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { config } from './lib/wagmi'

const queryClient = new QueryClient()
const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // 使用useState确保组件已挂载
  const [mounted, setMounted] = useState(false)

  // 仅在客户端挂载后处理类名
  useEffect(() => {
    // 检查并移除可能由浏览器扩展添加的类名和属性
    if (typeof document !== 'undefined') {
      // 处理翻译扩展
      const htmlElement = document.documentElement
      if (htmlElement.className.includes('trancy-zh-CN')) {
        // 移除类名以避免水合错误
        htmlElement.className = htmlElement.className
          .replace('trancy-zh-CN', '')
          .trim()
      }

      // 处理Grammarly扩展
      const bodyElement = document.body
      if (bodyElement.hasAttribute('data-gr-ext-installed')) {
        bodyElement.removeAttribute('data-gr-ext-installed')
      }
      if (bodyElement.hasAttribute('data-new-gr-c-s-check-loaded')) {
        bodyElement.removeAttribute('data-new-gr-c-s-check-loaded')
      }
    }
    setMounted(true)
  }, [])

  // 确保客户端相关代码只在组件挂载后执行
  if (!mounted) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className} suppressHydrationWarning>
          <div>加载中...</div>
        </body>
      </html>
    )
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <Navbar />
              <main>{children}</main>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  )
}
