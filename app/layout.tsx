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

  const accentColor = '#00FFFF' // Tailwind 'accent'
  const accentColorForeground = '#0D0D1A' // Tailwind 'background' (for text on accent)
  const primaryBackgroundColor = '#1A1A2E' // Tailwind 'primary'
  const secondaryBackgroundColor = '#2A2A4D' // Tailwind 'secondary'
  const foregroundColor = '#E0E0E0' // Tailwind 'foreground'
  const secondaryForegroundColor = '#A0A0A0' // Slightly dimmer foreground

  const customRainbowTheme = darkTheme({
    accentColor: accentColor,
    accentColorForeground: accentColorForeground,
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small',
    colors: {
      // --- Modal & Dropdown backgrounds ---
      modalBackground: primaryBackgroundColor,
      modalBorder: secondaryBackgroundColor,
      menuItemBackground: secondaryBackgroundColor, // Hover/focus on dropdown items

      // --- Connect Button (Unconnected State) ---
      connectButtonBackground: primaryBackgroundColor, // Default button background
      connectButtonText: foregroundColor,
      connectButtonBackgroundError: primaryBackgroundColor, // for error state button

      // --- Connected State Button / Address / Balance / Network Button ---
      // Make these sections use accentColor background and accentColorForeground text
      connectedButtonBackground: accentColor,
      connectButtonInnerBackground: accentColor,
      connectButtonText: accentColorForeground, // Text ON the connected button sections
      connectButtonTextError: foregroundColor,

      // --- Profile (Dropdown after clicking address) ---
      profileActionBackground: secondaryBackgroundColor, // e.g., "Copy Address", "Disconnect" hover
      profileActionText: foregroundColor,

      // --- Other text colors ---
      modalText: foregroundColor,
      modalTextSecondary: secondaryForegroundColor,
      actionButtonText: accentColorForeground, // Text on buttons that use `accentColor` as background

      // --- Potentially useful for further unification ---
      // selectedOptionBackgroundColor: accentColor, // Background for selected network in dropdown
      // selectedOptionTextColor: accentColorForeground,
      // generalBorder: secondaryBackgroundColor, // General borders if not specified elsewhere
      // modalBackdrop: 'rgba(0,0,0,0.7)', // Customize backdrop if needed
    },
  })

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
            <RainbowKitProvider theme={customRainbowTheme}>
              <Navbar />
              <main>{children}</main>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  )
}
