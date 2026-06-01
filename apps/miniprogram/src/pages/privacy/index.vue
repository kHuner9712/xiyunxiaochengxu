<template>
  <view class="privacy-page page-shell">
    <view class="content-section">
      <text class="section-title">隐私政策</text>
      <text class="update-date">更新日期：{{ legal.privacyPolicy.updatedAt }}</text>
      <text class="update-date">生效日期：{{ legal.privacyPolicy.effectiveAt }}</text>

      <text class="paragraph">{{ legal.companyName }}（以下简称“我们”）深知个人信息对您的重要性，我们将按照法律法规的规定，保护您的个人信息及隐私安全。</text>

      <text class="section-subtitle">一、我们收集的信息</text>
      <text class="paragraph">1.1 微信登录信息：我们通过微信授权获取您的 OpenID 和 UnionID，用于身份识别和登录。</text>
      <text class="paragraph">1.2 手机号码：用于订单配送联系和账号安全验证。您可拒绝授权手机号，但可能影响部分功能使用。</text>
      <text class="paragraph">1.3 收货地址：用于商品配送。包括收件人姓名、电话、省市区及详细地址。</text>
      <text class="paragraph">1.4 宝宝档案信息：用于提供个性化推荐服务。包括宝宝昵称、性别、出生日期等。此信息为自愿提供。</text>
      <text class="paragraph">1.5 订单与支付信息：用于订单处理和支付。包括商品信息、金额、支付状态等。</text>
      <text class="paragraph">1.6 售后图片：用于售后申请处理。您上传的商品问题图片仅用于售后审核。</text>

      <text class="section-subtitle">二、我们如何使用信息</text>
      <text class="paragraph">2.1 处理您的订单和支付。</text>
      <text class="paragraph">2.2 提供配送和自提服务。</text>
      <text class="paragraph">2.3 处理售后和退款请求。</text>
      <text class="paragraph">2.4 提供个性化商品推荐。</text>
      <text class="paragraph">2.5 改善我们的产品和服务。</text>

      <text class="section-subtitle">三、信息的保存</text>
      <text class="paragraph">3.1 您的个人信息存储在中华人民共和国境内的服务器上。</text>
      <text class="paragraph">3.2 我们仅在为您提供服务所必需的期限内保留您的个人信息。</text>

      <text class="section-subtitle">四、信息的删除</text>
      <text class="paragraph">4.1 您可联系我们删除您的个人信息。</text>
      <text class="paragraph">4.2 法律法规要求必须保留的信息除外。</text>

      <text class="section-subtitle">五、信息的共享</text>
      <text class="paragraph">5.1 未经您的同意，我们不会与第三方共享您的个人信息。</text>
      <text class="paragraph">5.2 为完成订单配送，我们会向物流服务提供方提供必要的配送信息。</text>

      <text class="section-subtitle">六、信息安全</text>
      <text class="paragraph">6.1 我们采用业界通用的安全技术保护您的个人信息。</text>
      <text class="paragraph">6.2 支付信息由微信支付安全体系保障。</text>

      <text class="section-subtitle">七、您的权利</text>
      <text class="paragraph">7.1 您有权访问、更正、删除您的个人信息。</text>
      <text class="paragraph">7.2 您有权撤回授权同意。</text>
      <text class="paragraph">7.3 您有权注销账号。</text>

      <text class="section-subtitle">八、未成年人保护</text>
      <text class="paragraph">8.1 我们高度重视对未成年人个人信息的保护。</text>
      <text class="paragraph">8.2 若您是未成年人的监护人，请您指导未成年人使用本服务。</text>

      <text class="section-subtitle">九、联系方式</text>
      <text class="paragraph">客服电话：{{ legal.contact.customerPhone }}</text>
      <text class="paragraph">客服微信：{{ legal.contact.customerWechat }}</text>
      <text class="paragraph">{{ legal.contact.serviceNotice }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { LEGAL_PROFILE as legal } from '@/config/legal'
</script>

<style lang="scss" scoped>
.privacy-page {
  min-height: 100vh;
  padding: $spacing-md;
}

.content-section {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 250, 246, 0.94) 100%);
  border-radius: $radius-xxl;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-sm;
  padding: $spacing-lg;
  padding-bottom: 60rpx;
}

.section-title {
  font-size: $font-xl;
  font-weight: 800;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-md;
  line-height: 1.28;
}

.update-date {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
  margin-bottom: 4rpx;
  padding-left: 18rpx;
  border-left: 6rpx solid rgba($success-color, 0.32);
}

.section-subtitle {
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  display: block;
  margin-top: $spacing-lg;
  margin-bottom: $spacing-sm;
}

.paragraph {
  font-size: $font-md;
  color: $text-secondary;
  line-height: 1.95;
  display: block;
  margin-bottom: $spacing-xs;
}

</style>
