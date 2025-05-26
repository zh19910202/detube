// app/api/pinata/route.ts
import { NextRequest, NextResponse } from 'next/server'

// 定义通用的CORS头信息
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// 获取环境变量
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT
  ? process.env.NEXT_PUBLIC_PINATA_JWT.replace(/^['"]/g, '').replace(
      /['"]$/g,
      ''
    )
  : ''
const PINATA_GW = process.env.NEXT_PUBLIC_PINATA_GW
  ? process.env.NEXT_PUBLIC_PINATA_GW.replace(/^['"]/g, '').replace(
      /['"]$/g,
      ''
    )
  : ''

// 处理 GET 请求 - 用于获取IPFS内容或文件列表
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const cid = searchParams.get('cid')
  const action = searchParams.get('action')
  const groupId = searchParams.get('groupId')

  // 处理文件列表请求
  if (action === 'list' && groupId) {
    try {
      // 构建Pinata API URL获取组文件列表
      const pinataUrl = `https://api.pinata.cloud/data/pinList?status=pinned&metadata[keyvalues][group]={"value":"${groupId}","op":"eq"}`

      // 发送请求到Pinata
      const response = await fetch(pinataUrl, {
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Pinata请求失败: ${response.statusText}`)
      }

      // 获取响应数据
      const data = await response.json()

      // 添加CORS头信息和缓存控制头并返回代理的响应
      return NextResponse.json(data, {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300', // 1分钟缓存，5分钟后台重新验证
        },
      })
    } catch (error) {
      console.error('获取Pinata文件列表失败:', error)
      return NextResponse.json(
        { error: '获取文件列表失败' },
        {
          status: 500,
          headers: corsHeaders,
        }
      )
    }
  }

  // 处理获取IPFS内容请求
  if (!cid) {
    return NextResponse.json(
      { error: '缺少CID参数' },
      {
        status: 400,
        headers: corsHeaders,
      }
    )
  }

  try {
    // 构建Pinata网关URL，确保包含完整协议
    const pinataUrl = `https://${PINATA_GW}/ipfs/${cid}`

    // 发送请求到Pinata
    const response = await fetch(pinataUrl, {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Pinata请求失败: ${response.statusText}`)
    }

    // 获取响应数据
    const data = await response.json()

    // 添加CORS头信息和缓存控制头并返回代理的响应
    return NextResponse.json(data, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5分钟缓存，10分钟后台重新验证
      },
    })
  } catch (error) {
    console.error('代理Pinata请求失败:', error)
    return NextResponse.json(
      { error: '获取IPFS内容失败' },
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}

// 处理 OPTIONS 请求 - 用于处理预检请求
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      },
    }
  )
}

// 处理 POST 请求 - 用于上传文件和JSON
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let requestBody
    let pinataUrl
    const pinataOptions: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
    }

    // 处理不同类型的请求
    if (contentType.includes('multipart/form-data')) {
      // 处理文件上传
      const formData = await request.formData()
      // 创建新的FormData对象，确保文件字段名为'file'
      const newFormData = new FormData()
      const file = formData.get('file')
      if (!file) {
        return NextResponse.json(
          { error: '未找到文件' },
          {
            status: 400,
            headers: corsHeaders,
          }
        )
      }
      newFormData.append('file', file)

      pinataUrl = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
      pinataOptions.body = newFormData
    } else {
      // 处理JSON上传
      requestBody = await request.json()
      const { data, options } = requestBody

      pinataUrl = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'
      pinataOptions.headers = {
        ...pinataOptions.headers,
        'Content-Type': 'application/json',
      }

      // 处理组ID，如果存在
      let pinataMetadata = options?.metadata || {}
      const pinataOptions2 = options?.pinataOptions || {}

      // 如果有组ID，添加到metadata中
      if (options?.pinataOptions?.pinataMetadata?.keyvalues?.group) {
        pinataMetadata = {
          ...pinataMetadata,
          keyvalues: {
            group: options.pinataOptions.pinataMetadata.keyvalues.group,
          },
        }
      }

      pinataOptions.body = JSON.stringify({
        pinataContent: data,
        pinataMetadata: pinataMetadata,
        pinataOptions: pinataOptions2,
      })
    }

    // 发送请求到Pinata
    const response = await fetch(pinataUrl, pinataOptions)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Pinata请求失败: ${response.statusText}, ${errorText}`)
    }

    // 获取响应数据
    const data = await response.json()

    // 添加CORS头信息并返回代理的响应
    return NextResponse.json(data, {
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('代理Pinata上传请求失败:', error)
    return NextResponse.json(
      { error: '上传到IPFS失败' },
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}
