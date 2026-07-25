from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old!r}")
    file.write_text(text.replace(old, new, 1))


replace(
    "apps/api/src/activity-content/activity-content.service.ts",
    "const data = this.buildUpdateData(dto, existing);",
    "const data = this.buildUpdateData(dto);",
)
replace(
    "apps/api/src/activity-content/activity-content.service.ts",
    "private buildUpdateData(dto: UpdateActivityContentDto, existing: any): any {",
    "private buildUpdateData(dto: UpdateActivityContentDto): any {",
)
replace(
    "apps/api/src/flash-sale/flash-sale.service.ts",
    "\nfunction parseDate(v: string | undefined): Date | undefined {\n"
    "  if (!v) return undefined;\n"
    "  const d = new Date(v);\n"
    "  return isNaN(d.getTime()) ? undefined : d;\n"
    "}\n",
    "",
)
replace(
    "apps/api/src/group-buy/group-buy.controller.ts",
    "  UseGuards,\n",
    "",
)
replace(
    "apps/api/src/group-buy/group-buy.service.ts",
    "    // 创建订单\n"
    "    let orderId: bigint;\n"
    "    try {\n"
    "      const order = await this.orderService.create(userId, {\n"
    "        items: [{ skuId: skuId.toString(), quantity }],\n"
    "        addressId: dto.addressId,\n"
    "        pickupStoreId: dto.pickupStoreId,\n"
    "        fulfillmentType: dto.fulfillmentType,\n"
    "        remark: dto.remark,\n"
    "        sourceType: 'direct',\n"
    "      });\n"
    "      orderId = BigInt(order.orderId);\n"
    "    } catch (err) {\n"
    "      throw err;\n"
    "    }\n",
    "    // 创建订单\n"
    "    const order = await this.orderService.create(userId, {\n"
    "      items: [{ skuId: skuId.toString(), quantity }],\n"
    "      addressId: dto.addressId,\n"
    "      pickupStoreId: dto.pickupStoreId,\n"
    "      fulfillmentType: dto.fulfillmentType,\n"
    "      remark: dto.remark,\n"
    "      sourceType: 'direct',\n"
    "    });\n"
    "    const orderId = BigInt(order.orderId);\n",
)
replace(
    "apps/api/src/order/dto/confirm-order.dto.spec.ts",
    "import { IsOptional, validateSync } from 'class-validator';",
    "import { validateSync } from 'class-validator';",
)
replace(
    "apps/api/src/order/dto/create-order.dto.ts",
    "import { Allow, IsInt,",
    "import { IsInt,",
)
replace(
    "apps/api/src/product/product.service.ts",
    "        orderBy: { sortOrder: 'asc' },",
    "        orderBy,",
)
