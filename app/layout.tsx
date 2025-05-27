'use client'
import { Inter } from 'next/font/google'
import './globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import Navbar from './components/Navbar'
import React, { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { config } from './lib/wagmi'
import { StagewiseToolbar } from '@stagewise/toolbar-next'

const queryClient = new QueryClient()
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  fallback: ['Helvetica', 'Arial', 'sans-serif'],
  preload: true,
})

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

  const stagewiseConfig = {
    plugins: [],
  }

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

  const customRainbowTheme = darkTheme({
    accentColor: '#00FFFF',
    accentColorForeground: '#0D0D1A',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small',
  })

  // To customize specific parts like button backgrounds, we usually merge
  // the base theme with our custom overrides.
  const finalTheme = {
    ...customRainbowTheme,
    colors: {
      ...customRainbowTheme.colors,
      connectButtonBackground: '#00FFFF',
      connectButtonText: '#0D0D1A',
    },
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>
          {`
            /* 备用字体样式，防止字体加载问题 */
            .font-fallback {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            }
          `}
        </style>
      </head>
      <body
        className={`${inter.className} font-fallback`}
        suppressHydrationWarning>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider theme={finalTheme}>
              <Navbar />
              <main>{children}</main>
              {process.env.NODE_ENV === 'development' && (
                <StagewiseToolbar config={stagewiseConfig} />
              )}
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  )
}
