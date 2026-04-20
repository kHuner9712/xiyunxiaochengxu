<template>
    <!-- 视频 -->
    <view :style="style_container">
        <view :style="style_img_container">
            <view class="video pr" :style="style">
                <!-- #ifndef APP -->
                <video :src="video" class="wh-auto ht-auto" :poster="video_img" objectFit="contain" style="object-fit: contain"></video>
                <!-- #endif-->
                <!-- #ifdef APP -->
                <video-player ref="domVideoPlayer" :poster="video_img" :src="video" objectFit="contain" controls />
                <!-- #endif-->
            </view>
        </view>
    </view>
</template>

<script>
    import { common_styles_computer, common_img_computer } from '@/common/js/common/common.js';
    import VideoPlayer from '@/pages/diy/components/common/video-player/video-player.vue';
    export default {
        components: {
            VideoPlayer,
        },
        props: {
            propValue: {
                type: Object,
                default: () => ({}),
            },
            propKey: {
                type: [String, Number],
                default: '',
            },
            propIsCommonStyle: {
                type: Boolean,
                default: true,
            },
            // 组件渲染的下�?
            propIndex: {
                type: Number,
                default: 1000000,
            },
        },
        data() {
            return {
                style_container: '',
                style_img_container: '',
                style: '',
                video_img: '',
                video: '',
            };
        },
        watch: {
            propKey(val) {
                // 初始�?
                this.init();
            },
        },
        created() {
            this.init();
        },
        methods: {
            // 初始化数�?
            init() {
                const new_content = this.propValue.content || {};
                const new_style = this.propValue.style || {};
                // 视频比例
                this.get_video_height(new_content.video_ratio);
                this.setData({
                    video_img: new_content.video_img.length > 0 ? new_content.video_img[0].url : '',
                    video: new_content.video.length > 0 ? new_content.video[0].url : '',
                    style_container: this.propIsCommonStyle ? common_styles_computer(new_style.common_style) : '',
                    style_img_container: this.propIsCommonStyle ? common_img_computer(new_style.common_style, this.propIndex) : '',
                });
            },
            // 获取视频高度
            get_video_height(data) {
                uni.getSystemInfo({
                    success: (res) => {
                        let video_ratio = ``;
                        const width = res.windowWidth;
                        if (data == '4:3') {
                            video_ratio = `height: ${(((width * 3) / 4) * 2).toFixed(2)}rpx;`;
                        } else if (data == '1:1') {
                            video_ratio = `height: ${width * 2}rpx;`;
                        } else {
                            // 16:9 保留两位小数
                            video_ratio = `height: ${(((width * 9) / 16) * 2).toFixed(2)}rpx;`;
                        }
                        this.setData({
                            style: video_ratio,
                        });
                    },
                });
            },
        },
    };
</script>

<style></style>
