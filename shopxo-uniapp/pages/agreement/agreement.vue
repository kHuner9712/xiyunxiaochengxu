<template>
    <view :class="theme_view">
        <view class="page-wrapper bg-f5">
            <view class="content-container padding-main">
                <view class="agreement-container bg-white border-radius-main padding-main">
                    <view class="agreement-title text-size-lg fw-b cr-base margin-bottom-main">{{ page_title }}</view>
                    <view class="agreement-content text-size-sm cr-base">
                        <view class="margin-bottom-lg">
                            <text class="fw-b">生效日期：</text>
                            <text>2025年1月1日</text>
                        </view>

                        <block v-if="agreement_type === 'privacy'">
                            <view class="margin-bottom-main">
                                <text class="fw-b">一、我们如何收集和使用您的个人信息</text>
                                <text class="block margin-top-xs">在您使用禧孕平台服务的过程中，我们可能会收集和使用您的以下信息：</text>
                                <text class="block margin-top-xs">1. 账号信息：手机号（用于登录和身份验证）、昵称、头像等，用于创建和登录账号。</text>
                                <text class="block margin-top-xs">2. 孕育信息：备孕/孕期/产后阶段、预产期、宝宝生日、宝宝月龄等，用于为您提供个性化的活动和内容推荐。</text>
                                <text class="block margin-top-xs">3. 活动报名信息：姓名、联系方式等，用于活动报名确认和签到核实。</text>
                                <text class="block margin-top-xs">4. 位置信息：当您使用活动签到、收货地址选择等功能时，我们会申请获取您的地理位置，用于提供基于位置的服务。您可以选择拒绝授权，不影响其他功能使用。</text>
                                <text class="block margin-top-xs">5. 相册/摄像头：当您更换头像或提交反馈图片时，我们会申请访问您的相册或摄像头，用于选择或拍摄图片。您可以选择拒绝授权，不影响其他功能使用。</text>
                                <text class="block margin-top-xs">6. 设备信息：设备型号、操作系统版本等，用于保障服务正常运行。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">二、我们如何使用您的个人信息</text>
                                <text class="block margin-top-xs">1. 向您提供活动报名、签到等服务。</text>
                                <text class="block margin-top-xs">2. 根据您的孕育阶段推荐适合的活动和内容。</text>
                                <text class="block margin-top-xs">3. 通过短信、推送等方式向您发送活动通知。</text>
                                <text class="block margin-top-xs">4. 保障平台服务安全，防范风险。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">三、我们如何共享、转让、公开披露您的个人信息</text>
                                <text class="block margin-top-xs">我们不会将您的个人信息提供给任何第三方，除非：</text>
                                <text class="block margin-top-xs">1. 获得您的明确同意。</text>
                                <text class="block margin-top-xs">2. 法律法规或政府机关要求。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">四、信息安全</text>
                                <text class="block margin-top-xs">我们采用合理的安全措施保护您的个人信息不被未经授权的访问、使用、披露、修改或损坏。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">五、您的权利</text>
                                <text class="block margin-top-xs">1. 您可以随时查看、修改您的个人信息。</text>
                                <text class="block margin-top-xs">2. 您可以选择注销账号，注销后我们将删除或匿名化您的个人信息。</text>
                                <text class="block margin-top-xs">3. 您可以在系统设置中随时关闭位置、相册等权限授权。</text>
                                <text class="block margin-top-xs">4. 您有权要求删除您的个人信息。如需申请数据删除，请通过以下方式联系我们：</text>
                                <text class="block margin-top-xs">　　a. 在"反馈"页面选择"数据删除/隐私请求"类型提交申请；</text>
                                <text class="block margin-top-xs">　　b. 联系平台客服提出数据删除请求；</text>
                                <text class="block margin-top-xs">　　我们将在15个工作日内处理您的请求，处理完成后您的敏感个人信息（手机号、孕育阶段、预产期、宝宝生日、报名信息、反馈联系方式等）将被匿名化或删除，订单记录将保留必要信息以保障售后权益。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">六、未成年人保护</text>
                                <text class="block margin-top-xs">我们的服务主要面向成年人。如未成年人使用我们的服务，应在监护人指导下进行。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">七、本政策的更新</text>
                                <text class="block margin-top-xs">我们可能会适时修订本隐私政策。修订后，我们会在平台内以适当方式通知您。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">八、联系我们</text>
                                <text class="block margin-top-xs">如您对本隐私政策有任何疑问或意见，请通过平台内的反馈功能或联系客服与我们联系。</text>
                            </view>
                        </block>

                        <block v-else-if="agreement_type === 'userregister'">
                            <view class="margin-bottom-main">
                                <text class="fw-b">一、服务范围</text>
                                <text class="block margin-top-xs">禧孕平台（以下简称"本平台"）为用户提供孕育阶段管理、活动报名、签到核实、内容推荐等相关服务。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">二、账号注册与使用</text>
                                <text class="block margin-top-xs">1. 您在注册时应当提供真实、准确、完整的个人信息。</text>
                                <text class="block margin-top-xs">2. 您应妥善保管您的账号信息，不得将账号转让、出借或分享给他人使用。</text>
                                <text class="block margin-top-xs">3. 如您发现账号被他人使用，请及时联系我们处理。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">三、用户行为规范</text>
                                <text class="block margin-top-xs">1. 您在使用本平台服务时应遵守国家相关法律法规。</text>
                                <text class="block margin-top-xs">2. 您不得利用本平台从事任何违法或侵害他人合法权益的行为。</text>
                                <text class="block margin-top-xs">3. 如发现违规行为，我们有权采取警告、限制功能、封禁账号等措施。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">四、知识产权</text>
                                <text class="block margin-top-xs">本平台上的所有内容（包括但不限于文字、图片、图标等）的知识产权归本平台或相关权利人所有，未经授权不得转载或使用。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">五、免责声明</text>
                                <text class="block margin-top-xs">1. 本平台提供的信息仅供参考，不构成医疗建议。如有孕育相关问题，请咨询专业医疗机构。</text>
                                <text class="block margin-top-xs">2. 因不可抗力或网络故障导致的服务中断，本平台不承担责任。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">六、服务变更与终止</text>
                                <text class="block margin-top-xs">1. 我们保留随时修改或终止本平台服务的权利。</text>
                                <text class="block margin-top-xs">2. 服务变更或终止时，我们将以适当方式通知您。</text>
                            </view>
                            <view class="margin-bottom-main">
                                <text class="fw-b">七、争议解决</text>
                                <text class="block margin-top-xs">因本用户协议引起的或与本用户协议有关的争议，双方应友好协商解决；协商不成的，任何一方均可向本平台运营方所在地有管辖权的人民法院提起诉讼。</text>
                            </view>
                        </block>

                        <block v-else>
                            <view class="margin-bottom-main">
                                <text>页面参数错误，请返回重试。</text>
                            </view>
                        </block>
                    </view>
                </view>
            </view>
        </view>

        <!-- 公共 -->
        <component-common ref="common"></component-common>
    </view>
</template>

<script>
    const app = getApp();
    import componentCommon from '@/components/common/common';

    export default {
        data() {
            return {
                theme_view: app.globalData.get_theme_value_view(),
                agreement_type: '',
                page_title: '',
            };
        },

        components: {
            componentCommon,
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
            var type = params.type || '';
            if (type === 'privacy') {
                this.setData({
                    agreement_type: 'privacy',
                    page_title: '隐私政策',
                });
            } else if (type === 'userregister') {
                this.setData({
                    agreement_type: 'userregister',
                    page_title: '用户协议',
                });
            } else {
                this.setData({
                    page_title: '协议详情',
                });
            }
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }
        },

        methods: {},
    };
</script>

<style>
    .page-wrapper {
        min-height: 100vh;
        background-color: #F5F5F5;
    }

    .content-container {
        padding-bottom: 40rpx;
    }

    .agreement-container {
        box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
    }

    .agreement-title {
        padding-bottom: 24rpx;
        border-bottom: 2rpx solid #F0F0F0;
    }

    .agreement-content text {
        line-height: 1.8;
    }

    .agreement-content .fw-b {
        color: #333;
    }
</style>
