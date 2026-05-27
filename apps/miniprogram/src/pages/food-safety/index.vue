<template>
  <view class="food-safety-page">
    <view class="content-section">
      <text class="section-title">食品安全与售后说明</text>
      <text class="update-date">更新日期：{{ legal.foodSafety.updatedAt }}</text>
      <text class="update-date">生效日期：{{ legal.foodSafety.effectiveAt }}</text>

      <text class="section-subtitle">一、食品安全承诺</text>
      <text class="paragraph">1.1 禧孕优选承诺所有食品类商品均通过合法渠道采购，符合国家食品安全标准。</text>
      <text class="paragraph">1.2 所有食品供应商均具备相应资质，商品具有合法来源。</text>
      <text class="paragraph">1.3 保健食品均取得国家批准文号或备案凭证，标注蓝帽标识。</text>
      <text class="paragraph">1.4 婴幼儿配方乳粉均取得产品配方注册号，符合国家相关规定。</text>

      <text class="section-subtitle">二、商品信息公示</text>
      <text class="paragraph">2.1 食品类商品详情页公示：生产厂家、生产许可证编号、保质期、贮存条件。</text>
      <text class="paragraph">2.2 保健食品额外公示：批准文号/备案号、适用人群、不适宜人群、注意事项。</text>
      <text class="paragraph">2.3 婴幼儿配方乳粉额外公示：产品配方注册号、适用年龄段。</text>

      <text class="section-subtitle">三、保健食品特别提示</text>
      <view class="health-warning">
        <text class="warning-text">保健食品不是药物，不能代替药物治疗疾病</text>
      </view>
      <text class="paragraph">3.1 保健食品仅用于特定人群补充营养、调节机体功能，不能替代正常膳食。</text>
      <text class="paragraph">3.2 本小程序不会对保健食品作疾病治疗、疗效承诺、替代药物等宣传。</text>

      <text class="section-subtitle">四、婴幼儿配方乳粉特别提示</text>
      <text class="paragraph">4.1 婴幼儿配方乳粉的宣传不使用夸大婴幼儿发育、智力、免疫等绝对化用语。</text>
      <text class="paragraph">4.2 母乳是婴儿最好的食物，配方乳粉仅在无法母乳喂养时使用。</text>

      <text class="section-subtitle">五、退换货规则</text>
      <text class="paragraph">5.1 食品类商品：如存在质量问题，支持7天内退换货。</text>
      <text class="paragraph">5.2 保健食品：如存在质量问题，支持7天内退换货。</text>
      <text class="paragraph">5.3 婴幼儿配方乳粉：如存在质量问题，支持7天内退换货。</text>
      <text class="paragraph">5.4 非质量问题的食品类商品，如已拆封，可能不支持退换货，具体以售后审核为准。</text>

      <text class="section-subtitle">六、退货地址</text>
      <text class="paragraph">{{ legal.contact.returnAddress }}</text>

      <text class="section-subtitle">七、联系方式</text>
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
.food-safety-page {
  min-height: 100vh;
  background: $bg-white;
  padding: $spacing-md;
}

.content-section {
  padding-bottom: 60rpx;
}

.section-title {
  font-size: $font-xl;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-md;
}

.update-date {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
  margin-bottom: 4rpx;
}

.section-subtitle {
  font-size: $font-lg;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-top: $spacing-lg;
  margin-bottom: $spacing-sm;
}

.paragraph {
  font-size: $font-md;
  color: $text-secondary;
  line-height: 1.8;
  display: block;
  margin-bottom: $spacing-xs;
}

.health-warning {
  background: #FFF3E0;
  border: 1rpx solid #FFB74D;
  border-radius: $radius-md;
  padding: $spacing-sm $spacing-md;
  margin: $spacing-sm 0;
}

.warning-text {
  font-size: $font-md;
  color: #E65100;
  font-weight: 600;
}

</style>
