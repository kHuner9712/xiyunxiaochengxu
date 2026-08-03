#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one match, found {count}: {old[:100]!r}')
    write(path, content.replace(old, new, 1))


def replace_count(path: str, old: str, new: str, expected: int) -> None:
    content = read(path)
    count = content.count(old)
    if count != expected:
        raise RuntimeError(f'{path}: expected {expected} matches, found {count}: {old[:100]!r}')
    write(path, content.replace(old, new))


# ---------------------------------------------------------------------------
# Product video persistence and test coverage
# ---------------------------------------------------------------------------
replace_once(
    'apps/api/src/product/product.service.ts',
    "          mainImage: dto.mainImage;\n",
    "          mainImage: dto.mainImage;\n",
) if False else None

replace_once(
    'apps/api/src/product/product.service.ts',
    "          mainImage: dto.mainImage,\n          images: dto.images,",
    "          mainImage: dto.mainImage,\n          videoUrl: dto.videoUrl,\n          images: dto.images,",
)
replace_once(
    'apps/api/src/product/product.service.ts',
    "      if (dto.mainImage !== undefined) updateData.mainImage = dto.mainImage;\n      if (dto.images !== undefined) updateData.images = dto.images;",
    "      if (dto.mainImage !== undefined) updateData.mainImage = dto.mainImage;\n      if (dto.videoUrl !== undefined) updateData.videoUrl = dto.videoUrl;\n      if (dto.images !== undefined) updateData.images = dto.images;",
)

product_test = 'apps/api/src/product/product.service.spec.ts'
replace_once(
    product_test,
    "  describe('ProductService.update SKU 兼容', () => {",
    "  describe('ProductService.update 商品视频', () => {\n"
    "    it('编辑商品时应持久化 videoUrl', async () => {\n"
    "      const tx = {\n"
    "        product: {\n"
    "          update: jest.fn<any>().mockResolvedValue({\n"
    "            id: BigInt(1),\n"
    "            name: '测试商品',\n"
    "            categoryId: BigInt(10),\n"
    "            videoUrl: '/uploads/public/product.mp4',\n"
    "            attributes: { compliance: { isRegulated: false } },\n"
    "            skus: [],\n"
    "          }) as any,\n"
    "        },\n"
    "        productSku: {\n"
    "          findMany: jest.fn() as any,\n"
    "          updateMany: jest.fn() as any,\n"
    "          update: jest.fn() as any,\n"
    "          create: jest.fn() as any,\n"
    "        },\n"
    "      };\n"
    "      prisma.product.findFirst.mockResolvedValue({ id: BigInt(1), deletedAt: null });\n"
    "      prisma.$transaction.mockImplementationOnce((fn: any) => fn(tx));\n\n"
    "      await service.update('1', { videoUrl: '/uploads/public/product.mp4' } as any);\n\n"
    "      expect(tx.product.update).toHaveBeenCalledWith(expect.objectContaining({\n"
    "        where: { id: BigInt(1) },\n"
    "        data: expect.objectContaining({ videoUrl: '/uploads/public/product.mp4' }),\n"
    "      }));\n"
    "    });\n"
    "  });\n\n"
    "  describe('ProductService.update SKU 兼容', () => {",
)

# ---------------------------------------------------------------------------
# WeChat order-management description and order-detail path support
# ---------------------------------------------------------------------------
write(
    'apps/api/src/payment/payment-description.ts',
    "export function buildWechatPaymentDescription(order: any): string {\n"
    "  const items = Array.isArray(order?.orderItems) ? order.orderItems : [];\n"
    "  const firstProductName = String(items[0]?.productName || '').trim();\n"
    "  const totalQuantity = items.reduce((sum: number, item: any) => {\n"
    "    const quantity = Number(item?.quantity || 0);\n"
    "    return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);\n"
    "  }, 0);\n\n"
    "  let description = firstProductName;\n"
    "  if (firstProductName && totalQuantity > 1) {\n"
    "    description = `${firstProductName}等${totalQuantity}件商品`;\n"
    "  }\n"
    "  if (!description) {\n"
    "    description = `订单${String(order?.orderNo || '').trim() || '商品购买'}`;\n"
    "  }\n"
    "  return description.slice(0, 127);\n"
    "}\n",
)
write(
    'apps/api/src/payment/payment-description.spec.ts',
    "import { buildWechatPaymentDescription } from './payment-description';\n\n"
    "describe('buildWechatPaymentDescription', () => {\n"
    "  it('使用真实商品名称和件数生成微信支付描述', () => {\n"
    "    expect(buildWechatPaymentDescription({\n"
    "      orderNo: 'O202608030001',\n"
    "      orderItems: [\n"
    "        { productName: '婴儿纸尿裤', quantity: 2 },\n"
    "        { productName: '婴儿湿巾', quantity: 1 },\n"
    "      ],\n"
    "    })).toBe('婴儿纸尿裤等3件商品');\n"
    "  });\n\n"
    "  it('没有商品明细时保留安全兜底且限制长度', () => {\n"
    "    const value = buildWechatPaymentDescription({ orderNo: 'X'.repeat(200), orderItems: [] });\n"
    "    expect(value.startsWith('订单')).toBe(true);\n"
    "    expect(value.length).toBeLessThanOrEqual(127);\n"
    "  });\n"
    "});\n",
)
replace_once(
    'apps/api/src/payment/payment.service.ts',
    "import { calculateOrderItemRefundCap } from '../common/utils/refund-amount';",
    "import { calculateOrderItemRefundCap } from '../common/utils/refund-amount';\nimport { buildWechatPaymentDescription } from './payment-description';",
)
replace_count(
    'apps/api/src/payment/payment.service.ts',
    "        include: { user: { select: { id: true, openid: true } } },",
    "        include: {\n"
    "          user: { select: { id: true, openid: true } },\n"
    "          orderItems: { select: { productName: true, quantity: true } },\n"
    "        },",
    2,
)
replace_once(
    'apps/api/src/payment/payment.service.ts',
    "    const description = order.orderItems?.[0]?.productName || `订单${order.orderNo}`;",
    "    const description = buildWechatPaymentDescription(order);",
)

replace_once(
    'apps/api/src/order/order.controller.ts',
    "  @Get('detail/:id')\n  async detail(@CurrentUser('id') userId: string, @Param('id') id: string) {\n    return this.orderService.findById(userId, id);\n  }",
    "  @Get('detail-by-no/:orderNo')\n"
    "  async detailByOrderNo(\n"
    "    @CurrentUser('id') userId: string,\n"
    "    @Param('orderNo') orderNo: string,\n"
    "  ) {\n"
    "    return this.orderService.findByOrderNo(userId, orderNo);\n"
    "  }\n\n"
    "  @Get('detail/:id')\n"
    "  async detail(@CurrentUser('id') userId: string, @Param('id') id: string) {\n"
    "    return this.orderService.findById(userId, id);\n"
    "  }",
)
replace_once(
    'apps/api/src/order/order.service.ts',
    "    if (!order) throw new NotFoundException('订单不存在');\n    return this.serializeOrderView(order);\n  }\n\n  async findAllAdmin(dto: OrderQueryDto) {",
    "    if (!order) throw new NotFoundException('订单不存在');\n"
    "    return this.serializeOrderView(order);\n"
    "  }\n\n"
    "  async findByOrderNo(userId: string, orderNo: string) {\n"
    "    const normalizedOrderNo = String(orderNo || '').trim();\n"
    "    if (!normalizedOrderNo) throw new BadRequestException('订单号不能为空');\n"
    "    const order = await this.prisma.order.findFirst({\n"
    "      where: { orderNo: normalizedOrderNo, userId: BigInt(userId) },\n"
    "      include: {\n"
    "        orderItems: { include: { aftersaleOrders: true } },\n"
    "        payment: true,\n"
    "        delivery: true,\n"
    "        orderLogs: { orderBy: { createdAt: 'desc' } },\n"
    "      },\n"
    "    });\n"
    "    if (!order) throw new NotFoundException('订单不存在');\n"
    "    return this.serializeOrderView(order);\n"
    "  }\n\n"
    "  async findAllAdmin(dto: OrderQueryDto) {",
)
replace_once(
    'apps/miniprogram/src/api/order.ts',
    "export function getOrderDetail(id: string | number) {\n  return get<OrderDetail>(`/weapp/order/detail/${id}`)\n}\n",
    "export function getOrderDetail(id: string | number) {\n"
    "  return get<OrderDetail>(`/weapp/order/detail/${id}`)\n"
    "}\n\n"
    "export function getOrderDetailByNo(orderNo: string) {\n"
    "  return get<OrderDetail>(`/weapp/order/detail-by-no/${encodeURIComponent(orderNo)}`)\n"
    "}\n",
)
replace_once(
    'apps/miniprogram/src/pages/order/detail.vue',
    "import { getOrderDetail, cancelOrder, confirmReceive, type OrderDetail, type OrderProductItem } from '@/api/order'",
    "import { getOrderDetail, getOrderDetailByNo, cancelOrder, confirmReceive, type OrderDetail, type OrderProductItem } from '@/api/order'",
)
replace_once(
    'apps/miniprogram/src/pages/order/detail.vue',
    "async function loadOrder(id: string) {\n  try {\n    order.value = await getOrderDetail(id)\n    if (shouldSelectAftersale.value) {\n      guideAftersaleSelection()\n    }\n  } catch {\n    uni.showToast({ title: '订单加载失败', icon: 'none' })\n  }\n}\n",
    "async function loadOrder(id: string) {\n"
    "  try {\n"
    "    order.value = await getOrderDetail(id)\n"
    "    if (shouldSelectAftersale.value) guideAftersaleSelection()\n"
    "  } catch {\n"
    "    uni.showToast({ title: '订单加载失败', icon: 'none' })\n"
    "  }\n"
    "}\n\n"
    "async function loadOrderByNo(orderNo: string) {\n"
    "  try {\n"
    "    order.value = await getOrderDetailByNo(orderNo)\n"
    "    if (shouldSelectAftersale.value) guideAftersaleSelection()\n"
    "  } catch {\n"
    "    uni.showToast({ title: '订单加载失败', icon: 'none' })\n"
    "  }\n"
    "}\n\n"
    "function getOptionValue(value: unknown): string {\n"
    "  return Array.isArray(value) ? String(value[0] || '') : String(value || '')\n"
    "}\n",
)
replace_once(
    'apps/miniprogram/src/pages/order/detail.vue',
    "onLoad((options) => {\n  shouldSelectAftersale.value = options?.selectAftersale === '1'\n  if (options?.id) loadOrder(options.id)\n})",
    "onLoad((options) => {\n"
    "  shouldSelectAftersale.value = getOptionValue(options?.selectAftersale) === '1'\n"
    "  const id = getOptionValue(options?.id)\n"
    "  const orderNo = getOptionValue(\n"
    "    options?.orderNo || options?.out_trade_no || options?.outTradeNo || options?.order_no\n"
    "  )\n"
    "  if (orderNo) {\n"
    "    loadOrderByNo(orderNo)\n"
    "  } else if (id) {\n"
    "    loadOrder(id)\n"
    "  } else {\n"
    "    uni.redirectTo({ url: '/pages/order/list' })\n"
    "  }\n"
    "})",
)

write(
    'docs/wechat-order-management.md',
    "# 微信小程序订单管理接入\n\n"
    "## 代码侧已完成\n\n"
    "- JSAPI 下单的 `description` 使用真实商品名称和商品件数，不再退化为纯订单编号。\n"
    "- 订单详情页支持通过内部 `id` 或商户订单号查询本人订单。\n"
    "- 支持微信订单中心常见参数名：`orderNo`、`out_trade_no`、`outTradeNo`、`order_no`。\n\n"
    "## 微信公众平台填写内容\n\n"
    "进入 **支付与交易 → 订单管理 → 订单信息录入**，填写：\n\n"
    "```text\n"
    "pages/order/detail?orderNo=${商品订单号}\n"
    "```\n\n"
    "`${商品订单号}` 会被微信替换为 JSAPI 下单时提交的 `out_trade_no`，本项目的 `out_trade_no` 即业务订单号 `order.orderNo`。\n\n"
    "请先上传包含该页面的新体验版或审核版本，再录入 Path，并使用微信的订单与卡包入口验证能否跳到对应订单。\n",
)

# ---------------------------------------------------------------------------
# Local video upload for content and product management
# ---------------------------------------------------------------------------
write(
    'apps/admin-web/src/api/upload.ts',
    "import request from '@/utils/request'\n\n"
    "type UploadProgressHandler = (percent: number) => void\n\n"
    "function uploadFile(file: File, groupName?: string, onProgress?: UploadProgressHandler) {\n"
    "  const formData = new FormData()\n"
    "  formData.append('file', file)\n"
    "  if (groupName) formData.append('groupName', groupName)\n"
    "  return request.post('/admin/file/upload', formData, {\n"
    "    headers: { 'Content-Type': 'multipart/form-data' },\n"
    "    timeout: 120000,\n"
    "    onUploadProgress: (event) => {\n"
    "      if (!onProgress || !event.total) return\n"
    "      onProgress(Math.min(100, Math.round((event.loaded * 100) / event.total)))\n"
    "    },\n"
    "  })\n"
    "}\n\n"
    "export const uploadApi = {\n"
    "  uploadFile,\n"
    "  uploadImage(file: File, groupName?: string, onProgress?: UploadProgressHandler) {\n"
    "    return uploadFile(file, groupName, onProgress)\n"
    "  },\n"
    "  uploadVideo(file: File, groupName = 'video', onProgress?: UploadProgressHandler) {\n"
    "    return uploadFile(file, groupName, onProgress)\n"
    "  },\n"
    "}\n",
)

content_edit = 'apps/admin-web/src/views/content/edit.vue'
replace_once(
    content_edit,
    "        <el-form-item v-if=\"form.contentType === 'video'\" label=\"视频链接\" prop=\"videoUrl\">\n          <el-input v-model=\"form.videoUrl\" placeholder=\"请输入视频链接（MP4格式）\" />\n        </el-form-item>",
    "        <el-form-item v-if=\"form.contentType === 'video'\" label=\"视频文件\" prop=\"videoUrl\">\n"
    "          <div class=\"video-upload-field\">\n"
    "            <el-upload\n"
    "              action=\"\"\n"
    "              :http-request=\"handleUploadVideo\"\n"
    "              :show-file-list=\"false\"\n"
    "              :before-upload=\"validateVideoFile\"\n"
    "              :disabled=\"videoUploading\"\n"
    "              accept=\"video/mp4,.mp4\"\n"
    "            >\n"
    "              <video v-if=\"form.videoUrl\" :src=\"form.videoUrl\" class=\"video-preview\" controls />\n"
    "              <el-button v-else size=\"small\" :loading=\"videoUploading\">\n"
    "                {{ videoUploading ? `上传中 ${videoUploadProgress}%` : '上传本地 MP4' }}\n"
    "              </el-button>\n"
    "            </el-upload>\n"
    "            <div class=\"video-upload-hint\">仅支持 MP4，最大 50MB；上传完成后保存内容即可在小程序播放。</div>\n"
    "            <el-button v-if=\"form.videoUrl\" type=\"danger\" link @click=\"removeVideo\">移除视频</el-button>\n"
    "          </div>\n"
    "        </el-form-item>",
)
replace_once(
    content_edit,
    "const submitting = ref(false)\nconst tagInputVisible = ref(false)",
    "const submitting = ref(false)\nconst videoUploading = ref(false)\nconst videoUploadProgress = ref(0)\nconst tagInputVisible = ref(false)",
)
replace_once(
    content_edit,
    "        callback(new Error('视频类型内容必须填写视频链接'))",
    "        callback(new Error('视频类型内容必须上传视频文件'))",
)
replace_once(
    content_edit,
    "async function handleUploadVideoCover(options: any) {\n  try {\n    const res = await uploadApi.uploadImage(options.file)\n    form.videoCover = res.data.url\n  } catch {}\n}\n",
    "async function handleUploadVideoCover(options: any) {\n"
    "  try {\n"
    "    const res = await uploadApi.uploadImage(options.file)\n"
    "    form.videoCover = res.data.url\n"
    "  } catch {}\n"
    "}\n\n"
    "function validateVideoFile(file: File): boolean {\n"
    "  const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')\n"
    "  if (!isMp4) {\n"
    "    ElMessage.error('仅支持 MP4 视频')\n"
    "    return false\n"
    "  }\n"
    "  if (file.size > 50 * 1024 * 1024) {\n"
    "    ElMessage.error('视频不能超过 50MB')\n"
    "    return false\n"
    "  }\n"
    "  return true\n"
    "}\n\n"
    "function readVideoDuration(file: File): Promise<number | undefined> {\n"
    "  return new Promise((resolve) => {\n"
    "    const url = URL.createObjectURL(file)\n"
    "    const video = document.createElement('video')\n"
    "    video.preload = 'metadata'\n"
    "    video.onloadedmetadata = () => {\n"
    "      const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : undefined\n"
    "      URL.revokeObjectURL(url)\n"
    "      resolve(duration)\n"
    "    }\n"
    "    video.onerror = () => {\n"
    "      URL.revokeObjectURL(url)\n"
    "      resolve(undefined)\n"
    "    }\n"
    "    video.src = url\n"
    "  })\n"
    "}\n\n"
    "async function handleUploadVideo(options: any) {\n"
    "  if (!validateVideoFile(options.file)) return\n"
    "  videoUploading.value = true\n"
    "  videoUploadProgress.value = 0\n"
    "  try {\n"
    "    const res = await uploadApi.uploadVideo(options.file, 'content-video', (percent) => {\n"
    "      videoUploadProgress.value = percent\n"
    "    })\n"
    "    const url = res?.data?.url || res?.data?.data?.url || res?.url || ''\n"
    "    if (!url) throw new Error('上传成功但未返回视频地址')\n"
    "    form.videoUrl = url\n"
    "    form.videoDuration = await readVideoDuration(options.file)\n"
    "    options.onSuccess?.(res)\n"
    "    ElMessage.success('视频上传成功')\n"
    "  } catch (error) {\n"
    "    options.onError?.(error)\n"
    "    ElMessage.error('视频上传失败')\n"
    "  } finally {\n"
    "    videoUploading.value = false\n"
    "  }\n"
    "}\n\n"
    "function removeVideo() {\n"
    "  form.videoUrl = ''\n"
    "  form.videoDuration = undefined\n"
    "  videoUploadProgress.value = 0\n"
    "}\n",
)
replace_once(
    content_edit,
    ".tags-input {\n  display: flex;",
    ".video-upload-field {\n"
    "  display: flex;\n"
    "  flex-direction: column;\n"
    "  align-items: flex-start;\n"
    "}\n\n"
    ".video-preview {\n"
    "  width: 360px;\n"
    "  max-width: 100%;\n"
    "  height: 220px;\n"
    "  object-fit: contain;\n"
    "  border-radius: 8px;\n"
    "  background: #000;\n"
    "}\n\n"
    ".video-upload-hint {\n"
    "  margin-top: 8px;\n"
    "  color: #909399;\n"
    "  font-size: 12px;\n"
    "}\n\n"
    ".tags-input {\n  display: flex;",
)

product_edit = 'apps/admin-web/src/views/product/edit.vue'
replace_once(
    product_edit,
    "          <el-upload action=\"\" :http-request=\"handleUploadVideo\" :show-file-list=\"false\" accept=\"video/*\" :limit=\"1\">\n            <video v-if=\"form.videoUrl\" :src=\"form.videoUrl\" style=\"width: 240px; height: 160px; object-fit: cover; border-radius: 6px\" controls />\n            <el-button v-else size=\"small\">上传视频</el-button>\n          </el-upload>",
    "          <el-upload\n"
    "            action=\"\"\n"
    "            :http-request=\"handleUploadVideo\"\n"
    "            :show-file-list=\"false\"\n"
    "            :before-upload=\"validateVideoFile\"\n"
    "            :disabled=\"videoUploading\"\n"
    "            accept=\"video/mp4,.mp4\"\n"
    "            :limit=\"1\"\n"
    "          >\n"
    "            <video v-if=\"form.videoUrl\" :src=\"form.videoUrl\" style=\"width: 240px; height: 160px; object-fit: contain; border-radius: 6px; background: #000\" controls />\n"
    "            <el-button v-else size=\"small\" :loading=\"videoUploading\">\n"
    "              {{ videoUploading ? `上传中 ${videoUploadProgress}%` : '上传视频' }}\n"
    "            </el-button>\n"
    "          </el-upload>",
)
replace_once(
    product_edit,
    "const submitting = ref(false)\nconst categoryTree",
    "const submitting = ref(false)\nconst videoUploading = ref(false)\nconst videoUploadProgress = ref(0)\nconst categoryTree",
)
replace_once(
    product_edit,
    "async function handleUploadVideo(options: any) {\n  try {\n    const res = await uploadApi.uploadImage(options.file, 'product-video')\n    const uploadedUrl = sanitizeUrl(res?.data?.url)\n    if (uploadedUrl) form.videoUrl = uploadedUrl\n  } catch {\n    ElMessage.error('视频上传失败')\n  }\n}\n",
    "function validateVideoFile(file: File): boolean {\n"
    "  const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')\n"
    "  if (!isMp4) {\n"
    "    ElMessage.error('仅支持 MP4 视频')\n"
    "    return false\n"
    "  }\n"
    "  if (file.size > 50 * 1024 * 1024) {\n"
    "    ElMessage.error('视频不能超过 50MB')\n"
    "    return false\n"
    "  }\n"
    "  return true\n"
    "}\n\n"
    "async function handleUploadVideo(options: any) {\n"
    "  if (!validateVideoFile(options.file)) return\n"
    "  videoUploading.value = true\n"
    "  videoUploadProgress.value = 0\n"
    "  try {\n"
    "    const res = await uploadApi.uploadVideo(options.file, 'product-video', (percent) => {\n"
    "      videoUploadProgress.value = percent\n"
    "    })\n"
    "    const uploadedUrl = extractUploadUrl(res)\n"
    "    if (!uploadedUrl) throw new Error('上传成功但未返回视频地址')\n"
    "    form.videoUrl = uploadedUrl\n"
    "    options.onSuccess?.(res)\n"
    "  } catch (error) {\n"
    "    options.onError?.(error)\n"
    "    ElMessage.error('视频上传失败')\n"
    "  } finally {\n"
    "    videoUploading.value = false\n"
    "  }\n"
    "}\n",
)

# Raise upload limits consistently to 50MB, with Nginx headroom.
replace_once('apps/api/src/upload/upload.multer-options.ts', 'const DEFAULT_UPLOAD_MAX_SIZE = 10485760;', 'const DEFAULT_UPLOAD_MAX_SIZE = 52428800;')
replace_once('apps/api/src/upload/upload.service.ts', "process.env.UPLOAD_MAX_SIZE || '10485760'", "process.env.UPLOAD_MAX_SIZE || '52428800'")
replace_once('.env.example', 'UPLOAD_MAX_SIZE=10485760', 'UPLOAD_MAX_SIZE=52428800')
replace_once('deploy/docker-compose.yml', 'UPLOAD_MAX_SIZE: ${UPLOAD_MAX_SIZE:-10485760}', 'UPLOAD_MAX_SIZE: ${UPLOAD_MAX_SIZE:-52428800}')
replace_count('deploy/nginx/conf.d/default.conf', '    client_max_body_size 20m;', '    client_max_body_size 60m;', 2)

# ---------------------------------------------------------------------------
# Order export UX hardening (the API and permission already existed)
# ---------------------------------------------------------------------------
admin_order = 'apps/admin-web/src/views/order/list.vue'
replace_once(
    admin_order,
    "          <el-button v-permission=\"'order:export'\" @click=\"handleExport\">导出</el-button>",
    "          <el-button v-permission=\"'order:export'\" :loading=\"exporting\" @click=\"handleExport\">导出</el-button>",
)
replace_once(
    admin_order,
    "const loading = ref(false)\nconst tableData",
    "const loading = ref(false)\nconst exporting = ref(false)\nconst tableData",
)
replace_once(
    admin_order,
    "async function handleExport() {\n  try {\n    const res = await orderApi.export(buildQueryParams())\n    const contentType = String(res.headers?.['content-type'] || '').toLowerCase()\n    const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: contentType || 'text/csv;charset=utf-8;' })\n    if (contentType.includes('application/json')) {\n      const text = await blob.text()\n      let message = '导出失败'\n      try {\n        const parsed = JSON.parse(text)\n        message = parsed?.message || message\n      } catch {}\n      throw new Error(message)\n    }\n\n    const url = window.URL.createObjectURL(blob)\n    const a = document.createElement('a')\n    a.href = url\n    a.download = getFileNameFromDisposition(res.headers['content-disposition']) || `orders-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`\n    a.click()\n    window.URL.revokeObjectURL(url)\n  } catch (e: any) {\n    ElMessage.error(e?.message || '导出失败')\n  }\n}",
    "async function handleExport() {\n"
    "  if (exporting.value) return\n"
    "  exporting.value = true\n"
    "  try {\n"
    "    const res = await orderApi.export(buildQueryParams())\n"
    "    const contentType = String(res.headers?.['content-type'] || '').toLowerCase()\n"
    "    const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: contentType || 'text/csv;charset=utf-8;' })\n"
    "    if (contentType.includes('application/json')) {\n"
    "      const text = await blob.text()\n"
    "      let message = '导出失败'\n"
    "      try {\n"
    "        const parsed = JSON.parse(text)\n"
    "        message = parsed?.message || message\n"
    "      } catch {}\n"
    "      throw new Error(message)\n"
    "    }\n\n"
    "    const url = window.URL.createObjectURL(blob)\n"
    "    const a = document.createElement('a')\n"
    "    a.href = url\n"
    "    a.download = getFileNameFromDisposition(res.headers['content-disposition']) || `orders-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`\n"
    "    document.body.appendChild(a)\n"
    "    a.click()\n"
    "    a.remove()\n"
    "    window.URL.revokeObjectURL(url)\n"
    "    ElMessage.success('订单导出成功')\n"
    "  } catch (e: any) {\n"
    "    ElMessage.error(e?.message || '导出失败')\n"
    "  } finally {\n"
    "    exporting.value = false\n"
    "  }\n"
    "}",
)

# ---------------------------------------------------------------------------
# Repository-wide native input/textarea clipping fixes
# ---------------------------------------------------------------------------
replace_once(
    'apps/miniprogram/src/styles/common.scss',
    ".form-input,\n.form-textarea {\n  background: rgba($bg-gray, 0.8);\n  border-radius: $radius-lg;\n  padding: 18rpx 22rpx;\n  color: $text-color;\n  font-size: $font-md;\n}\n",
    ".form-input {\n"
    "  height: 72rpx;\n"
    "  min-height: 72rpx;\n"
    "  line-height: 72rpx;\n"
    "  padding: 0 22rpx;\n"
    "  background: rgba($bg-gray, 0.8);\n"
    "  border-radius: $radius-lg;\n"
    "  color: $text-color;\n"
    "  font-size: $font-md;\n"
    "}\n\n"
    ".form-textarea {\n"
    "  min-height: 160rpx;\n"
    "  padding: 18rpx 22rpx;\n"
    "  background: rgba($bg-gray, 0.8);\n"
    "  border-radius: $radius-lg;\n"
    "  color: $text-color;\n"
    "  font-size: $font-md;\n"
    "  line-height: 1.6;\n"
    "}\n\n"
    ".native-input-placeholder {\n"
    "  color: $text-hint;\n"
    "  line-height: inherit;\n"
    "}\n\n"
    ".native-textarea-placeholder {\n"
    "  color: $text-hint;\n"
    "  line-height: 1.6;\n"
    "}\n",
)

address = 'apps/miniprogram/src/pages/address/edit.vue'
replace_once(address, '<input class="form-input" v-model="form.name" placeholder="请输入收货人姓名" />', '<input class="form-input" v-model="form.name" placeholder="请输入收货人姓名" placeholder-class="native-input-placeholder" />')
replace_once(address, '<input class="form-input" v-model="form.phone" placeholder="请输入手机号" type="number" maxlength="11" />', '<input class="form-input" v-model="form.phone" placeholder="请输入手机号" placeholder-class="native-input-placeholder" type="number" maxlength="11" />')
replace_once(address, '<textarea class="form-textarea" v-model="form.detail" placeholder="请输入详细地址" />', '<textarea class="form-textarea" v-model="form.detail" placeholder="请输入详细地址" placeholder-class="native-textarea-placeholder" />')
replace_once(
    address,
    "  &.switch-item {\n    justify-content: space-between;\n  }",
    "  &.switch-item {\n"
    "    justify-content: space-between;\n\n"
    "    .form-label {\n"
    "      width: auto;\n"
    "      white-space: nowrap;\n"
    "    }\n"
    "  }",
)
replace_once(
    address,
    ".form-input {\n  flex: 1;\n  font-size: $font-md;\n  min-width: 0;\n  background: $bg-soft;\n  border-radius: $radius-lg;\n  padding: 16rpx 20rpx;\n}",
    ".form-input {\n"
    "  flex: 1;\n"
    "  min-width: 0;\n"
    "  height: 72rpx;\n"
    "  min-height: 72rpx;\n"
    "  line-height: 72rpx;\n"
    "  padding: 0 20rpx;\n"
    "  background: $bg-soft;\n"
    "  border-radius: $radius-lg;\n"
    "  font-size: $font-md;\n"
    "}",
)
replace_once(
    address,
    ".form-textarea {\n  flex: 1;\n  font-size: $font-md;\n  min-height: 120rpx;\n  min-width: 0;\n  background: $bg-soft;\n  border-radius: $radius-lg;\n  padding: 16rpx 20rpx;\n}",
    ".form-textarea {\n"
    "  flex: 1;\n"
    "  min-width: 0;\n"
    "  height: 260rpx;\n"
    "  min-height: 260rpx;\n"
    "  padding: 18rpx 20rpx;\n"
    "  background: $bg-soft;\n"
    "  border-radius: $radius-lg;\n"
    "  font-size: $font-md;\n"
    "  line-height: 1.6;\n"
    "}",
)

baby = 'apps/miniprogram/src/pages/baby/edit.vue'
replace_once(baby, 'placeholder-class="form-input-placeholder"', 'placeholder-class="native-input-placeholder"')
replace_once(baby, "  height: 72rpx;\n  line-height: 72rpx;", "  height: 72rpx;\n  min-height: 72rpx;\n  line-height: 72rpx;")
replace_once(baby, "\n.form-input-placeholder {\n  line-height: 72rpx;\n}\n", "\n")

profile = 'apps/miniprogram/src/pages/user/profile.vue'
replace_once(profile, '          placeholder="请输入昵称"\n          maxlength="20"', '          placeholder="请输入昵称"\n          placeholder-class="native-input-placeholder"\n          maxlength="20"')
replace_once(
    profile,
    ".nickname-input {\n  flex: 1;\n  min-width: 0;\n  height: 56rpx;\n  color: $text-color;\n  font-size: $font-md;\n  text-align: right;\n}",
    ".nickname-input {\n"
    "  flex: 1;\n"
    "  min-width: 0;\n"
    "  height: 64rpx;\n"
    "  min-height: 64rpx;\n"
    "  line-height: 64rpx;\n"
    "  color: $text-color;\n"
    "  font-size: $font-md;\n"
    "  text-align: right;\n"
    "}",
)

search = 'apps/miniprogram/src/pages/search/index.vue'
replace_once(search, '          placeholder="输入商品名称或品类"\n          confirm-type="search"', '          placeholder="输入商品名称或品类"\n          placeholder-class="native-input-placeholder"\n          confirm-type="search"')
replace_once(
    search,
    ".search-input {\n  flex: 1;\n  min-width: 0;\n  width: 100%;\n  font-size: 25rpx;\n}",
    ".search-input {\n"
    "  flex: 1;\n"
    "  min-width: 0;\n"
    "  width: 100%;\n"
    "  height: 72rpx;\n"
    "  min-height: 72rpx;\n"
    "  line-height: 72rpx;\n"
    "  font-size: 25rpx;\n"
    "}",
)

activity_list = 'apps/miniprogram/src/pages/activity-content/list.vue'
replace_once(activity_list, '        placeholder="搜索活动标题"\n        confirm-type="search"', '        placeholder="搜索活动标题"\n        placeholder-class="native-input-placeholder"\n        confirm-type="search"')
replace_once(
    activity_list,
    "  width: 100%;\n  min-height: 76rpx;\n  padding: 0 28rpx;",
    "  width: 100%;\n  height: 76rpx;\n  min-height: 76rpx;\n  line-height: 76rpx;\n  padding: 0 28rpx;",
)

after_apply = 'apps/miniprogram/src/pages/aftersale/apply.vue'
replace_once(after_apply, '<textarea class="form-textarea" v-model="form.description" placeholder="请描述具体问题" />', '<textarea class="form-textarea" v-model="form.description" placeholder="请描述具体问题" placeholder-class="native-textarea-placeholder" />')

after_detail = 'apps/miniprogram/src/pages/aftersale/detail.vue'
replace_once(after_detail, 'placeholder="请输入物流公司" />', 'placeholder="请输入物流公司" placeholder-class="native-input-placeholder" />')
replace_once(after_detail, 'placeholder="请输入物流单号" />', 'placeholder="请输入物流单号" placeholder-class="native-input-placeholder" />')
replace_once(after_detail, 'placeholder="选填" />\n        </view>\n        <view class="modal-field">\n          <text class="modal-label">备注</text>\n          <textarea', 'placeholder="选填" placeholder-class="native-input-placeholder" />\n        </view>\n        <view class="modal-field">\n          <text class="modal-label">备注</text>\n          <textarea')
replace_once(after_detail, 'v-model="returnLogisticsForm.remark" placeholder="选填" />', 'v-model="returnLogisticsForm.remark" placeholder="选填" placeholder-class="native-textarea-placeholder" />')
replace_once(
    after_detail,
    ".modal-input,\n.modal-textarea {\n  width: 100%;\n  box-sizing: border-box;\n  border-radius: $radius-lg;\n  background: $bg-soft;\n  padding: 18rpx 20rpx;\n  font-size: $font-sm;\n  color: $text-color;\n}\n\n.modal-textarea {\n  min-height: 132rpx;\n}",
    ".modal-input {\n"
    "  width: 100%;\n"
    "  height: 72rpx;\n"
    "  min-height: 72rpx;\n"
    "  line-height: 72rpx;\n"
    "  padding: 0 20rpx;\n"
    "  border-radius: $radius-lg;\n"
    "  background: $bg-soft;\n"
    "  font-size: $font-sm;\n"
    "  color: $text-color;\n"
    "}\n\n"
    ".modal-textarea {\n"
    "  width: 100%;\n"
    "  min-height: 132rpx;\n"
    "  padding: 18rpx 20rpx;\n"
    "  border-radius: $radius-lg;\n"
    "  background: $bg-soft;\n"
    "  font-size: $font-sm;\n"
    "  color: $text-color;\n"
    "  line-height: 1.6;\n"
    "}",
)

confirm = 'apps/miniprogram/src/pages/order/confirm.vue'
replace_once(confirm, '<input class="remark-input" v-model="remark" placeholder="填写备注" />', '<input class="remark-input" v-model="remark" placeholder="填写备注" placeholder-class="native-input-placeholder" />')
replace_once(
    confirm,
    ".remark-input {\n  width: 260rpx;\n  font-size: $font-sm;\n  text-align: right;\n  color: $text-color;\n  flex-shrink: 0;",
    ".remark-input {\n"
    "  width: 260rpx;\n"
    "  height: 64rpx;\n"
    "  min-height: 64rpx;\n"
    "  line-height: 64rpx;\n"
    "  font-size: $font-sm;\n"
    "  text-align: right;\n"
    "  color: $text-color;\n"
    "  flex-shrink: 0;",
)

# Durable audit test: all miniprogram native controls must declare placeholder classes
# and their primary class must provide safe sizing/line-height.
write(
    'apps/miniprogram/src/__tests__/native-control-safety.spec.ts',
    "import { describe, expect, it } from 'vitest'\n"
    "import { readdirSync, readFileSync, statSync } from 'node:fs'\n"
    "import { join } from 'node:path'\n\n"
    "function collectVueFiles(dir: string): string[] {\n"
    "  return readdirSync(dir).flatMap((name) => {\n"
    "    const path = join(dir, name)\n"
    "    return statSync(path).isDirectory() ? collectVueFiles(path) : path.endsWith('.vue') ? [path] : []\n"
    "  })\n"
    "}\n\n"
    "describe('native control clipping safety', () => {\n"
    "  it('all inputs and textareas use explicit placeholder classes and safe dimensions', () => {\n"
    "    const files = collectVueFiles(join(process.cwd(), 'src'))\n"
    "    const tagPattern = /<(input|textarea)\\b([^>]*)>/gis\n"
    "    const failures: string[] = []\n\n"
    "    for (const file of files) {\n"
    "      const source = readFileSync(file, 'utf8')\n"
    "      for (const match of source.matchAll(tagPattern)) {\n"
    "        const tag = match[1].toLowerCase()\n"
    "        const attrs = match[2]\n"
    "        const className = attrs.match(/\\bclass=[\"']([^\"']+)[\"']/i)?.[1]?.split(/\\s+/)[0]\n"
    "        if (!attrs.includes('placeholder-class=')) {\n"
    "          failures.push(`${file}: <${tag}> missing placeholder-class`)\n"
    "        }\n"
    "        if (!className) {\n"
    "          failures.push(`${file}: <${tag}> missing class`)\n"
    "          continue\n"
    "        }\n"
    "        const escaped = className.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')\n"
    "        const styleBlock = source.match(new RegExp(`\\\\.${escaped}\\\\s*\\\\{([^}]*)\\\\}`, 's'))?.[1] || ''\n"
    "        if (!/(?:^|\\s)(?:height|min-height)\\s*:/.test(styleBlock)) {\n"
    "          failures.push(`${file}: .${className} missing height/min-height`)\n"
    "        }\n"
    "        if (!/(?:^|\\s)line-height\\s*:/.test(styleBlock)) {\n"
    "          failures.push(`${file}: .${className} missing line-height`)\n"
    "        }\n"
    "      }\n"
    "    }\n\n"
    "    expect(failures, failures.join('\\n')).toEqual([])\n"
    "  })\n"
    "})\n",
)

print('All requested order, video, export, and native-control changes applied.')
