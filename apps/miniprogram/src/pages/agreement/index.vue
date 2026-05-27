<template>
  <view class="agreement-page">
    <view class="content-section">
      <text class="section-title">用户协议</text>
      <text class="update-date">更新日期：2026年__月__日</text>
      <text class="update-date">生效日期：2026年__月__日</text>

      <text class="paragraph">欢迎您使用禧孕优选小程序。请您在使用前仔细阅读以下用户协议。</text>

      <text class="section-subtitle">一、服务说明</text>
      <text class="paragraph">1.1 禧孕优选是由临沂禧孕文化传媒有限公司运营的自营母婴用品商城微信小程序，提供母婴用品、食品、奶粉、保健品等商品的在线购买服务。</text>
      <text class="paragraph">1.2 本协议是您与临沂禧孕文化传媒有限公司之间关于使用禧孕优选小程序服务所订立的协议。</text>

      <text class="section-subtitle">二、用户注册与登录</text>
      <text class="paragraph">2.1 您通过微信授权登录使用本小程序服务。</text>
      <text class="paragraph">2.2 您应确保提供的个人信息真实、准确、完整。</text>

      <text class="section-subtitle">三、商品与订单</text>
      <text class="paragraph">3.1 本小程序展示的商品信息仅供参考，以实际商品为准。</text>
      <text class="paragraph">3.2 您提交订单并完成支付后，即构成购买合同。</text>
      <text class="paragraph">3.3 商品价格可能随时调整，以您下单时的价格为准。</text>

      <text class="section-subtitle">四、支付与退款</text>
      <text class="paragraph">4.1 本小程序支持微信支付。</text>
      <text class="paragraph">4.2 退款按照售后规则执行，原路退回。</text>

      <text class="section-subtitle">五、配送与自提</text>
      <text class="paragraph">5.1 本小程序支持快递配送和到店自提。</text>
      <text class="paragraph">5.2 自提订单请在自提点营业时间内凭自提码取货。</text>

      <text class="section-subtitle">六、知识产权</text>
      <text class="paragraph">6.1 本小程序所有内容（包括但不限于文字、图片、视频、软件等）的知识产权归临沂禧孕文化传媒有限公司所有。</text>

      <text class="section-subtitle">七、免责声明</text>
      <text class="paragraph">7.1 因不可抗力导致服务中断，本公司不承担责任。</text>
      <text class="paragraph">7.2 本公司有权在提前通知的情况下修改本协议。</text>

      <text class="section-subtitle">八、联系方式</text>
      <text class="paragraph">客服电话：15864850841（暂定，上线前需确认）</text>
      <text class="paragraph">客服微信：shengxin9712（暂定，上线前需确认）</text>

      <view class="todo-notice">
        <text class="todo-text">【TODO】以上内容为模板，需由运营/法务审核确认后替换为正式内容。</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
</script>

<style lang="scss" scoped>
.agreement-page {
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

.todo-notice {
  margin-top: $spacing-xl;
  padding: $spacing-md;
  background: #FFF3E0;
  border-radius: $radius-md;
}

.todo-text {
  font-size: $font-sm;
  color: #E65100;
}
</style>
