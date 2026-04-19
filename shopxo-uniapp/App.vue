<script>
    import base64 from './common/js/lib/base64.js';
    // 澶氳瑷€寮曞叆骞跺垵濮嬪寲
    import i18n from './locale/index';
    import devConfig from './common/js/config/dev.js';
    import prodConfig from './common/js/config/prod.js';
    import { PHASE_ONE_DISABLED_PLUGIN_NAMES, PHASE_ONE_DISABLED_ROUTE_PREFIXES, is_phase_one_disabled_route as is_phase_one_disabled_route_match } from './common/js/config/phase-one-scope.js';
    var isProd = process.env.NODE_ENV === 'production';
    var appConfig = isProd ? prodConfig : devConfig;
    var request_url_value = isProd ? appConfig.request_url : (appConfig.request_url || 'http://localhost:8080/');
    if (isProd && !request_url_value) {
        console.error('[FATAL] 鐢熶骇鐜鏈厤缃?UNI_APP_REQUEST_URL锛屽簲鐢ㄦ棤娉曟甯歌繍琛?);
    }
    export default {
        globalData: {
            data: {
                // 鍩虹閰嶇疆
                // 鏁版嵁鎺ュ彛璇锋眰鍦板潃
                request_url: request_url_value,

                // 闈欐€佽祫婧愬湴鍧€锛堝绯荤粺鏍圭洰褰曚笉鍦╬ublic鐩綍涓嬮潰璇峰湪闈欐€佸湴鍧€鍚庨潰鍔爌ublic鐩綍銆佸锛歨ttps://d1.shopxo.vip/public/锛?
                static_url: appConfig.static_url || '',

                // 绯荤粺绫诲瀷锛堥粯璁efault銆佸棰濆鐙珛灏忕▼搴忋€佸彲涓庣▼搴忓垎韬彃浠跺疄鐜颁笉鍚屼富浣撳皬绋嬪簭鍙婃敮浠樼嫭绔嬶級
                system_type: 'default',

                // 鍩虹淇℃伅
                application_title: '瀛曠Η',
                application_describe: '瀛曠Η - 绉戝瀛曡偛路瀹夊績闄即',

                // 榛樿logo銆佸 /static/images/common/logo.png
                application_logo: '',

                // 鐗堟湰鍙枫€佸: v1.0.0
                version: 'v6.8.0',

                // app鐗堟湰淇℃伅銆佸: v1.0.0 20180118
                app_version_info: 'v6.8.0 20260305',

                // 璐у竵浠锋牸绗﹀彿
                currency_symbol: '锟?,

                // 榛樿涓婚        涓婚棰滆壊
                // 绾㈣壊 red       #ff0036
                // 榛勮壊 yellow    #f6c133
                // 榛戣壊 black     #333333
                // 缁胯壊 green     #20a53a
                // 姗欒壊 orange    #fe6f04
                // 钃濊壊 blue      #1677ff
                // 妫曡壊 brown     #8B4513
                // 绱壊 purple    #623cec
                // 姣嶅┐ muying    #F5A0B1
                default_theme: 'muying',

                // 澶氳瑷€鍒楄〃
                // 澧炲姞鎴栬€呭噺灏戣瑷€鏃?
                // 1.鏂板涓€涓璞★紝鎸夌収褰撳墠鏍煎紡鏂板
                // 2.鍘籰ang閲岄潰鍚勪釜鏂囦欢鍘绘柊澧炶瑷€缈昏瘧
                default_language: 'zh',

                // 绯荤粺tabbar
                system_tabbar: [
                    '/pages/index/index',
                    '/pages/goods-category/goods-category',
                    '/pages/activity/activity',
                    '/pages/cart/cart',
                    '/pages/user/user'
                ],
                // 涓€鏈熸敹鍙ｏ細缁熶竴缁存姢绂佺敤鎻掍欢涓庤矾鐢卞墠缂€
                phase_one_disabled_plugins: PHASE_ONE_DISABLED_PLUGIN_NAMES,
                phase_one_disabled_route_prefixes: PHASE_ONE_DISABLED_ROUTE_PREFIXES,

                // 鍏叡閰嶇疆
                // 鏄惁澶氬晢鎴峰簵閾篿d
                plugins_shop_id: null,

                // 鏄惁澶氶棬搴楅棬搴梚d
                plugins_realstore_id: null,

                // 鏄惁浣跨敤鍘熺敓鑿滃崟锛?鍚? 1鏄級
                is_use_native_tabbar: 0,

                // 璐墿杞﹂〉闈㈤《閮ㄥ鑸己鍒跺叧闂棬搴楋紙0鍚? 1鏄級
                is_cart_header_close_realstore: 0,

                // 鍟嗗搧璇︽儏椤靛簳閮ㄥ鑸槸鍚﹀紑鍚喘鐗╄溅鍔熻兘锛?鍚? 1鏄級
                is_goods_bottom_opt_cart: 1,

                // 鍟嗗搧璇︽儏椤靛簳閮ㄥ鑸瓨鍦ㄦ寚瀹氳繑鍥炲弬鏁癧is_opt_back=1]灞曠ず杩斿洖鎸夐挳锛?鍚? 1鏄級
                is_goods_bottom_opt_back: 1,

                // 鍏ㄧ珯闃绘鎵撳紑鍟嗗搧璇︽儏椤甸潰锛?鍚? 1鏄級
                is_forbid_to_goods_detail: 0,

                // 鍒嗕韩鍙婅浆鍙戜娇鐢ㄩ〉闈㈣缃殑榛樿鍥剧墖鍙婄郴缁熼粯璁ゅ浘鐗囷紙0鍚? 1鏄級
                is_share_use_image: 1,

                // 寮€鍚诞鍔ㄥ鏈嶃€佸墠鎻愭槸鍚庡彴闇€瑕佸紑鍚鏈嶅姛鑳斤紙0鍚? 1鏄級
                is_online_service_fixed: 1,

                // 鍒嗙被椤甸潰鍟嗗搧鍒楄〃妯″紡涓€绾у垎绫讳娇鐢ㄥ浘鏍囩被鍨嬶紙0 瀹炴櫙鍥? 1 icon鍥炬爣, 2 澶у浘鐗囷級
                category_goods_model_icon_type: 0,

                // 鍟嗗搧鍒嗙被椤甸潰鎼滅储杩涘叆鐙珛鎼滅储椤甸潰锛?鍚? 1鏄級
                category_goods_is_search_alone: 0,

                // 鍟嗗搧鍒嗙被椤甸潰寮€鍚喘鐗╄溅瀵艰埅锛?鍚? 1鏄級
                category_goods_is_show_cart_nav: 1,

                // 鐢ㄦ埛涓績鑿滃崟榛樿灞曠ず妯″紡锛? 涔濆鏍? 1 鍒楄〃锛?
                user_center_nav_show_model_type: 0,

                // 鍟嗗搧鍒楄〃鏄惁灞曠ず璐墿杞︼紙0鍚? 1鏄級
                is_goods_list_show_cart_opt: 1,

                // 鍒嗛攢椤甸潰鍦板浘鍒嗗竷鏄惁寮哄埗鑾峰彇褰撳墠浣嶇疆锛?鍚? 1鏄級
                is_distribution_map_force_location: 0,

                // 鏄惁寮€鍚井淇￠殣绉佸脊绐楁巿鏉冩彁绀恒€佷粎寰俊灏忕▼搴忔湁鏁堬紙0鍚? 1鏄級
                is_weixin_privacy_setting: 1,
                
                // 寮瑰嚭鑾峰彇鐢ㄦ埛褰撳墠浣嶇疆锛?鍚? 1鏄級
                get_user_location_status: 0,
                get_user_location_timer: null,

                // 寰俊灏忕▼搴忔墦寮€鍦板浘浣跨敤锛?鍚? 1鏄級銆愯吘璁綅缃湇鍔¤矾绾胯鍒掋€戞彃浠躲€侊紙闇€瑕佸埌灏忕▼搴忓悗鍙拌缃?>绗笁鏂硅缃?>鎻掍欢绠＄悊閲岄潰娣诲姞銆愯吘璁綅缃湇鍔¤矾绾胯鍒掋€戞彃浠讹紝鏁欑▼ https://mp.weixin.qq.com/wxopen/plugindevdoc?appid=wx50b5593e81dd937a锛?
                is_weixin_open_location_use_plugins: 0,

                // 棣栭〉鎼滅储妗嗗紑鍚壂涓€鎵嚜鍔紙0鍚? 1鏄級浠呫€愬皬绋嬪簭銆丄PP銆戞敮鎸?
                is_home_search_scan: 1,

                // 寮哄埗浣跨敤鏂囧瓧浣滀负logo锛堥粯璁ゅ綋鍓嶆寚瀹歭ogo->鍚庡彴绔欑偣璁剧疆鎵嬫満绔浘鐗噇ogo->鍚庡彴鎵嬫満绠＄悊灏忕▼搴忛厤缃悕绉?>绔欑偣璁剧疆涓殑绔欑偣鍚嶇О锛?
                is_home_logo_use_text: 0,

                // 棣栭〉寮€鍚湴鐞嗕綅缃€夋嫨锛?鍚? 1鏄級浼樺厛绾ч珮浜巐ogo灞曠ず
                is_home_location_choice: 0,

                // 澶氬晢鎴?- 搴楅摵璇︽儏椤堕儴瀵艰埅杩斿洖鎸夐挳锛?鍚? 1鏄級
                is_shop_top_nav_back: 1,

                // 澶氶棬搴?- 闂ㄥ簵璇︽儏椤堕儴瀵艰埅杩斿洖鎸夐挳锛?鍚? 1鏄級
                is_realstore_top_nav_back: 1,

                // 澶氶棬搴?- 闂ㄥ簵璇︽儏鎼滅储妗嗗唴鎵爜鍔犺喘锛?鍚? 1鏄級
                is_realstore_top_search_scan: 1,

                // 澶氶棬搴?- 闂ㄥ簵璇︽儏闃绘璺宠浆鍒板晢鍝佽鎯呴〉闈㈠幓锛?鍚? 1鏄級
                is_realstore_forbid_to_goods_detail: 0,

                // 閽卞寘鎻掍欢璐у竵绗﹀彿浣跨敤褰撳墠 currency_symbol 鏁版嵁鐨勫浐瀹氬€硷紙0鍚? 1鏄級
                is_wallet_use_fixed_currency_symbol: 0,

                // 鍔犺浇鏄惁浣跨敤楠ㄦ灦灞忥紙0鍚? 1鏄級
                is_loading_use_skeleton: 0,

                // 鍔犺浇鍔ㄧ敾绫诲瀷锛?logo, 1鍚嶇О锛?
                loading_content_type: 0,


                // 鏁版嵁缂撳瓨key
                // 鍦烘櫙鍊?
                cache_scene_key: 'cache_scene_key',

                // uuid缂撳瓨key
                cache_user_uuid_key: 'cache_user_uuid_key',

                // 閰嶇疆淇℃伅缂撳瓨key
                cache_config_info_key: 'cache_config_info_key',

                // 鐢ㄦ埛鐧诲綍缂撳瓨key
                cache_user_login_key: 'cache_user_login_key',

                // 鐢ㄦ埛淇℃伅缂撳瓨key
                cache_user_info_key: 'cache_shop_user_info_key',

                // 璁惧淇℃伅缂撳瓨key
                cache_system_info_key: 'cache_shop_system_info_key',

                // 鐢ㄦ埛鍦板潃閫夋嫨缂撳瓨key
                cache_buy_user_address_select_key: 'cache_buy_user_address_select_key',

                // 鍚姩鍙傛暟缂撳瓨key
                cache_launch_info_key: 'cache_shop_launch_info_key',

                // 鑾峰彇浣嶇疆閫夋嫨缂撳瓨key
                cache_userlocation_key: 'cache_userlocation_key',

                // 鍦板尯缁勪欢閫夋嫨缂撳瓨key
                cache_region_picker_choice_key: 'cache_region_picker_choice_key',

                // 鏃堕棿缁勪欢閫夋嫨缂撳瓨key
                cache_time_select_choice_key: 'cache_time_select_choice_key',

                // 椤甸潰鏀粯涓存椂缂撳瓨key
                cache_page_pay_key: 'cache_page_pay_key',

                // 涓婁竴椤靛湴鍧€缂撳瓨key
                cache_prev_page_key: 'cache_prev_page_key',

                // tab椤甸潰鍒囨崲鍙傛暟
                cache_page_tabbar_switch_params: 'cache_page_tabbar_switch_params_key',

                // 鐢ㄦ埛鍩虹璧勬枡鎻愮ず闂撮殧key
                cache_user_base_personal_interval_time_key: 'cache_user_base_personal_interval_time_key',

                // 鐢ㄦ埛璐墿杞﹂€夋嫨璁板綍key
                cache_user_cart_not_use_data_key: 'cache_user_cart_not_use_data_key',

                // 鏈櫥褰曢〉闈㈢紦瀛樿褰昸ey
                cache_user_no_login_page_status_data_key: 'cache_user_no_login_page_status_data_key',

                // app鏇存柊鎻愮ず缂撳瓨璁板綍key
                cache_app_update_tips_interval_time_key: 'cache_app_update_tips_interval_time_key',

                // app璇勫垎鎻愮ず缂撳瓨璁板綍key
                cache_app_star_tips_interval_time_key: 'cache_app_star_tips_interval_time_key',

                // 棣栭〉鏁版嵁缂撳瓨key
                cache_index_data_key: 'cache_index_data_key',

                // 鍟嗗搧鏁版嵁缂撳瓨key
                cache_goods_data_key: 'cache_goods_data_key',

                // 椤甸潰璁捐椤甸潰鏁版嵁缂撳瓨key
                cache_design_page_data_key: 'cache_design_page_data_key',

                // 搴曢儴鑿滃崟閫変腑绱㈠紩缂撳瓨key
                cache_footer_active_key: 'cache_footer_active_key',

                // diy妯″潡鏁版嵁缂撳瓨key
                cache_diy_data_key: 'cache_diy_data_key',
                // diy椤甸潰鏁版嵁缂撳瓨key
                cache_diy_page_data_key: 'cache_diy_page_data_key',

                // apptabbar搴曢儴鑿滃崟楂樺害
                cache_app_system_tabbar_height_key: 'cache_app_system_tabbar_height_key',

                // diy搴曢儴鑿滃崟楂樺害
                cache_app_diy_tabbar_height_key: 'cache_app_diy_tabbar_height_key',

                // apptabbar搴曢儴鑿滃崟瑙掓爣鏁版嵁
                cache_tabbar_badge_key: 'cache_tabbar_badge_key',

                // 鎼滅储鍘嗗彶璁板綍
                cache_search_history_key: 'cache_search_history_key',

                // 闂ㄥ簵閫夋嫨璇︽儏缂撳瓨
                cache_realstore_detail_choice_key: 'cache_realstore_detail_choice_key',

                // 浜掕仈缃戝尰闄㈠氨璇婁汉閫夋嫨鏁版嵁
                cache_hospital_patient_choice_value_key: 'cache_hospital_patient_choice_value_key',

                // 榛樿鐢ㄦ埛澶村儚
                default_user_head_src: '/static/images/common/user.png',

                // 鎴愬姛鍦嗗舰鎻愮ず鍥剧墖
                default_round_success_icon: '/static/images/common/round-success-icon.png',

                // 閿欒鍦嗗舰鎻愮ず鍥剧墖
                default_round_error_icon: '/static/images/common/round-error-icon.png',

                // 鍏朵粬鏁版嵁
                // 鍏叡鏁版槸鍚﹀凡鍒濆鍖栨垚鍔?
                common_data_loading_status: 0,
                common_data_init_config_back_list: [],
                common_data_init_status: 0,
                common_data_init_back_timer: null,
                // 缃戠粶鐘舵€佹鏌?
                network_type_page_record_timer: null,
                // 浣嶇疆鐩戝惉鏇存柊椤甸潰涓存椂璁板綍鏁版嵁
                location_update_page_temp_record_data: [],
            },

            /**
             * 鍚姩鍙傛暟澶勭悊
             */
            launch_params_handle(params) {
                // 鍘熸湁缂撳瓨
                var cache_params = this.get_launch_cache_info();
                // 褰撳墠鍙傛暟銆佷粠query璇诲彇瑕嗙洊
                if ((params.query || null) != null) {
                    params = params.query;
                }
                // query涓媠cene鍙傛暟瑙ｆ瀽澶勭悊
                if ((params.scene || null) != null) {
                    params = this.url_params_to_json(decodeURIComponent(params.scene));
                }
                // 濡傛灉褰撳墠娌℃湁閭€璇穒d銆佷絾鏄師濮嬬紦瀛樻湁閭€璇穒d銆佸垯浣跨敤缂撳瓨閭€璇穒d
                if ((params['referrer'] || null) == null && cache_params != null && (cache_params.referrer || null) != null) {
                    params['referrer'] = cache_params.referrer;
                }
                return params;
            },

            /**
             * 褰撳墠鏄惁鍗曢〉妯″紡
             */
            is_current_single_page() {
                var scene = this.get_scene_data();
                // #ifdef MP-WEIXIN
                return scene == 1154 ? 1 : 0;
                // #endif
                return 0;
            },

            /**
             * 鍦烘櫙鍊艰幏鍙?
             */
            get_scene_data() {
                return uni.getStorageSync(this.data.cache_scene_key) || 0;
            },

            /**
             * 鍦烘櫙鍊艰缃?
             */
            set_scene_data(params) {
                var scene = (params.scene || null) == null ? 0 : parseInt(params.scene);
                uni.setStorageSync(this.data.cache_scene_key, scene);
                return scene;
            },

            /**
             * 鑾峰彇璁惧淇℃伅
             * key      鎸囧畾key
             * dv       榛樿鏁版嵁锛堜笉瀛樺湪鍒欒鍙栥€侀粯璁ull锛?
             * is_real  鏄惁瀹炴椂璇诲彇
             */
            get_system_info(key, dv, is_real) {
                var info = null;
                if ((is_real || false) == true) {
                    info = this.set_system_info() || null;
                } else {
                    info = uni.getStorageSync(this.data.cache_system_info_key) || null;
                }
                if (info == null || (key || null) == null) {
                    return info;
                }
                return info[key] == undefined ? (dv == undefined ? null : dv) : info[key];
            },

            /**
             * 璁剧疆璁惧淇℃伅
             */
            set_system_info() {
                var system_info = uni.getSystemInfoSync();
                uni.setStorageSync(this.data.cache_system_info_key, system_info);
                return system_info;
            },

            /**
             * 璇锋眰鍦板潃鐢熸垚
             * a              鏂规硶
             * c              鎺у埗鍣?
             * plugins        鎻掍欢鏍囪锛堜紶鍙傚垯琛ㄧず涓烘彃浠惰姹傦級
             * params         url璇锋眰鍙傛暟
             * group          缁勫悕绉帮紙榛樿 api锛?
             */
            get_request_url(a, c, plugins, params, group) {
                a = a || 'index';
                c = c || 'index';
                // 鏄惁鎻掍欢璇锋眰銆佽蛋api缁熶竴鎻掍欢璋冪敤鎺у埗鍣?
                var plugins_params = '';
                if ((plugins || null) != null) {
                    plugins_params = '&pluginsname=' + plugins + '&pluginscontrol=' + c + '&pluginsaction=' + a;
                    c = 'plugins';
                    a = 'index';
                }
                // 鍙傛暟澶勭悊
                params = params || '';
                if (params != '' && params.substr(0, 1) != '&') {
                    params = '&' + params;
                }
                var url = this.data.request_url + (group || 'api') + '.php?s=' + c + '/' + a + plugins_params;
                return this.request_params_handle(url) + '&ajax=ajax' + params;
            },

            /**
             * 璇锋眰鍙傛暟澶勭悊
             * url     url鍦板潃
             */
            request_params_handle(url) {
                // 鎷兼帴瀛楃
                let query_str = '';
                // 鐢ㄦ埛淇℃伅
                let user = this.get_user_cache_info();
                let token = user == null ? '' : user.token || '';
                let uuid = this.request_uuid();
                let client_value = this.application_client_type();
                let client_brand = this.application_client_brand();
                    query_str += '&application_client_type=' + client_value + '&application_client_brand=' + client_brand+'&token=' + token+'&uuid=' + uuid;

                // 鍚姩鍙傛暟
                let params = this.get_launch_cache_info() || null;
                // 閭€璇蜂俊鎭?
                if(params != null && ( params.referrer || null) != null) {
                    query_str += '&referrer=' +  params.referrer;
                }

                // 鐢ㄦ埛浣嶇疆
                let user_location = this.choice_user_location_init() || null;
                if(user_location != null && (user_location.status || 0) == 1) {
                    query_str += '&user_lng=' + (user_location.lng || '') + '&user_lat=' + (user_location.lat || '');
                }

                // 褰撳墠璇█
                let lang = this.get_language_value();
                    query_str += '&lang=' + lang;
                // 褰撳墠涓婚
                let theme = this.get_theme_value();
                    query_str += '&theme='+theme;

                // 绗笁鏂圭櫥褰曟彃浠?3dsky骞冲彴璺宠浆杩囨潵 鐧诲綍token
                if(params != null && (params['mztToken'] || null) != null) {
                    query_str += '&mzt_token='+params['mztToken'];
                }

                // 鎷兼帴鏍囪瘑
                var join = url.indexOf('?') == -1 ? '?' : '&';
                return url + join + 'system_type=' + this.data.system_type + '&application=app'+ query_str;
            },

            /**
             * 鑾峰彇tab椤甸潰鍒囨崲鍙傛暟
             */
            get_page_tabbar_switch_params() {
                return uni.getStorageSync(this.data.cache_page_tabbar_switch_params) || null;
            },

            /**
             * 鍒犻櫎tab椤甸潰鍒囨崲鍙傛暟
             */
            remove_page_tabbar_switch_params() {
                uni.removeStorageSync(this.data.cache_page_tabbar_switch_params);
            },

            /**
             * 鏄惁闇€瑕佺櫥褰?
             * 鏄惁闇€瑕佺粦瀹氭墜鏈哄彿鐮?
             */
            user_is_bind_mobile(user, object, method, params, is_to_login = false) {
                if ((user || null) != null && (user.mobile || null) == null && parseInt(user.is_mandatory_bind_mobile || 0) == 1) {
                    if(is_to_login) {
                        this.login_confirm_tips_modal(this, object, method, params);
                    }
                    return true;
                }
                return false;
            },

            /**
             * 鑾峰彇鐢ㄦ埛淇℃伅,淇℃伅涓嶅瓨鍦ㄥ垯鍞ら啋鎺堟潈
             * object     鍥炶皟鎿嶄綔瀵硅薄
             * method     鍥炶皟鎿嶄綔瀵硅薄鐨勫嚱鏁?
             * params     鍥炶皟鎿嶈姹傚弬鏁?
             * return     鏈夌敤鎴锋暟鎹洿鎺ヨ繑鍥? 鍒欏洖璋冭皟鐢ㄨ€?
             */
            get_user_info(object, method, params) {
                var user = this.get_user_cache_info();
                if (user == null) {
                    var self = this;
                    uni.getNetworkType({
                        success: function (res) {
                            if (res.networkType != 'none') {
                                // #ifdef MP
                                // 灏忕▼搴忓敜閱掔敤鎴锋巿鏉?
                                self.user_login(object, method, params);
                                // #endif

                                // #ifdef APP
                                // app鐧诲綍娉ㄥ唽
                                self.app_login_handle(self, object, method, params);
                                // #endif

                                // #ifdef H5
                                // h5鐧诲綍娉ㄥ唽
                                self.login_confirm_tips_modal(self, object, method, params);
                                // #endif
                            }
                        },
                    });
                    return false;
                } else {
                    // 鏄惁闇€瑕佺粦瀹氭墜鏈?
                    if(this.user_is_bind_mobile(user, object, method, params, true)) {
                        return false;
                    }
                }
                return user;
            },

            // app鐧诲綍澶勭悊
            app_login_handle(self, object, method, params) {
                // 鏄惁寮€鍚竴閿櫥褰曟湇鍔?
                if (self.get_config('plugins_base.thirdpartylogin.data.apponekeyusermobile_is_enable') == 1) {
                    uni.getProvider({
                        service: 'oauth',
                        success: function (res) {
                            if (res.provider.includes('univerify')) {
                                // 棰勭櫥褰曟鏌?
                                uni.preLogin({
                                    provider: 'univerify',
                                    success(res) {
                                        // 鏄剧ず涓€閿櫥褰曞脊绐?
                                        var theme_color = self.get_theme_color();
                                        var theme_color_light = self.get_theme_color(null, true);
                                        uni.login({
                                            provider: 'univerify',
                                            univerifyStyle: {
                                                authButton: {
                                                    // 鎺堟潈鎸夐挳姝ｅ父鐘舵€佽儗鏅鑹?榛樿鍊硷細#3479f5
                                                    normalColor: theme_color,
                                                    // 鎺堟潈鎸夐挳鎸変笅鐘舵€佽儗鏅鑹?榛樿鍊硷細#2861c5锛堜粎ios鏀寔锛?
                                                    highlightColor: theme_color_light,
                                                    // 鎺堟潈鎸夐挳涓嶅彲鐐瑰嚮鏃惰儗鏅鑹?榛樿鍊硷細#73aaf5锛堜粎ios鏀寔锛?
                                                    disabledColor: theme_color_light,
                                                    // 鎺堟潈鎸夐挳鏂囨 榛樿鍊硷細鈥滄湰鏈哄彿鐮佷竴閿櫥褰曗€?
                                                    title: i18n.t('shopxo-uniapp.app.5a7r0v'),
                                                },
                                                otherLoginButton: {
                                                    // 鍏朵粬鐧诲綍鏂瑰紡鎸夐挳鏂囧瓧 榛樿鍊硷細鈥滃叾浠栫櫥褰曟柟寮忊€?
                                                    title: i18n.t('login.login.9q27d8'),
                                                },
                                                privacyTerms: {
                                                    // 鏉℃鍓嶇殑鏂囨 榛樿鍊硷細鈥滄垜宸查槄璇诲苟鍚屾剰鈥?
                                                    prefix: i18n.t('shopxo-uniapp.app.33k281'),
                                                    // 鏉℃鍚庣殑鏂囨 榛樿鍊硷細鈥滃苟浣跨敤鏈満鍙风爜鐧诲綍鈥?
                                                    suffix: i18n.t('shopxo-uniapp.app.8l688n'),
                                                    // 鑷畾涔夊崗璁潯娆撅紝鏈€澶ф敮鎸?涓紝闇€瑕佸悓鏃惰缃畊rl鍜宼itle. 鍚﹀垯涓嶇敓鏁?
                                                    privacyItems: [
                                                        {
                                                            url: self.get_config('config.agreement_userregister_url'),
                                                            title: i18n.t('shopxo-uniapp.app.28r5dr'),
                                                        },
                                                        {
                                                            url: self.get_config('config.agreement_userprivacy_url'),
                                                            title: i18n.t('shopxo-uniapp.app.lb493k'),
                                                        },
                                                    ],
                                                },
                                            },
                                            success(res) {
                                                // 鍦ㄥ緱鍒癮ccess_token鍜宱penid鍚庯紝閫氳繃callfunction璋冪敤浜戝嚱鏁?
                                                uniCloud
                                                    .callFunction({
                                                        name: 'getPhoneNumber',
                                                        data: {
                                                            access_token: res.authResult.access_token,
                                                            openid: res.authResult.openid,
                                                        },
                                                    })
                                                    .then((res) => {
                                                        uni.request({
                                                            url: self.get_request_url('apponekeyusermobile', 'index', 'thirdpartylogin'),
                                                            method: 'POST',
                                                            data: {
                                                                mobile: res.result,
                                                            },
                                                            dataType: 'json',
                                                            success: (res) => {
                                                                uni.closeAuthView();
                                                                if (res.data.code == 0) {
                                                                    uni.setStorageSync(self.data.cache_user_info_key, res.data.data);
                                                                    if (typeof object === 'object' && (method || null) != null) {
                                                                        object[method](params);
                                                                    }
                                                                } else {
                                                                    self.showToast(res.data.msg);
                                                                }
                                                            },
                                                            fail: () => {
                                                                uni.closeAuthView();
                                                                self.showToast(i18n.t('common.internet_error_tips'));
                                                            },
                                                        });
                                                    })
                                                    .catch((err) => {
                                                        uni.closeAuthView();
                                                        self.showToast(i18n.t('shopxo-uniapp.app.ch1pd2'));
                                                    });
                                            },
                                            fail(res) {
                                                // 鍏抽棴涓€閿櫥褰曞脊绐?
                                                uni.closeAuthView();
                                                // 鐢ㄦ埛鐐瑰嚮浜嗗叾浠栫櫥褰曟柟寮忋€佸垯杩涘叆鐧诲綍椤甸潰
                                                if (res.errCode == 30002) {
                                                    // 杩涘叆鐙珛鐧诲綍娉ㄥ唽椤甸潰
                                                    uni.navigateTo({
                                                        url: '/pages/login/login',
                                                    });
                                                } else {
                                                    // 鐢ㄦ埛涓嶆槸鐐瑰嚮鍏抽棴楠岃瘉鐣岄潰鍒欐彁绀洪敊璇?
                                                    if (res.errCode != 30003) {
                                                        self.showToast(res.errMsg + '(' + res.errCode + ')');
                                                    }
                                                }
                                            },
                                        });
                                    },
                                    fail(res) {
                                        self.login_confirm_tips_modal(self, object, method, params);
                                    },
                                });
                            } else {
                                self.login_confirm_tips_modal(self, object, method, params);
                            }
                        },
                        fail(res) {
                            self.login_confirm_tips_modal(self, object, method, params);
                        },
                    });
                } else {
                    self.login_confirm_tips_modal(self, object, method, params);
                }
            },

            // 鏈櫥褰曠‘璁ゅ鐞?
            login_confirm_tips_modal(self, object, method, params) {
                // 鏄惁tabbar椤甸潰
                var page = self.current_page(false);
                var is_tabbar = self.is_system_tabbar_pages('/'+page);
                // 闈炲垵濮嬪寲 骞朵笖 闈瀟abbar椤甸潰鍒欏叧闂綋鍓嶉〉闈㈠苟璺宠浆鐧诲綍椤甸潰
                if(method == 'init' && !is_tabbar) {
                    uni.redirectTo({
                        url: '/pages/login/login'
                    });
                // 鍒濆鍖栭〉闈㈠苟涓旀槸tabbar椤甸潰
                } else if(method == 'init' && is_tabbar) {
                    var key = this.data.cache_user_no_login_page_status_data_key;
                    var data = uni.getStorageSync(key) || [];
                    if(data.indexOf(page) == -1) {
                        data.push(page);
                        uni.setStorageSync(key, data);
                        uni.navigateTo({
                            url: '/pages/login/login'
                        });
                    }
                // 闈炲垵濮嬪寲鍒欑洿鎺ヨ烦杞櫥褰曢〉闈?
                } else if(method != 'init') {
                    uni.navigateTo({
                        url: '/pages/login/login'
                    });
                }
            },

            /**
             * 浠庣紦瀛樿幏鍙栫敤鎴蜂俊鎭€佸彲鎸囧畾key鍜岄粯璁ゅ€?
             * key              鏁版嵁key
             * default_value    榛樿鍊?
             */
            get_user_cache_info(key, default_value) {
                var user = uni.getStorageSync(this.data.cache_user_info_key) || null;
                if (user == null) {
                    // 鏄惁瀛樺湪榛樿鍊?
                    return default_value == undefined ? null : default_value;
                }
                // 鏄惁璇诲彇key
                if ((key || null) != null) {
                    return user[key] == undefined ? (default_value == undefined ? null : default_value) : user[key];
                }
                return user;
            },

            /**
             * 绯荤粺鍙傛暟鑾峰彇
             */
            get_launch_cache_info() {
                return uni.getStorageSync(this.data.cache_launch_info_key) || null;
            },

            /**
             * 绯荤粺鍙傛暟璁剧疆
             */
            set_launch_cache_info(params) {
                params = this.launch_params_handle(params);
                uni.setStorageSync(this.data.cache_launch_info_key, params);
                return params;
            },

            /**
             * 鑾峰彇鐧诲綍鎺堟潈鏁版嵁
             */
            get_login_cache_info() {
                return uni.getStorageSync(this.data.cache_user_login_key) || null;
            },

            /**
             * 鐢ㄦ埛鐧诲綍
             * object     鍥炶皟鎿嶄綔瀵硅薄
             * method     鍥炶皟鎿嶄綔瀵硅薄鐨勫嚱鏁?
             * params     鍥炶皟璇锋眰鍙傛暟
             * auth_data  鎺堟潈鏁版嵁
             */
            user_auth_login(object, method, params, auth_data) {
                var self = this;
                // #ifdef MP-WEIXIN || MP-QQ || MP-BAIDU || MP-TOUTIAO || MP-KUAISHOU
                uni.checkSession({
                    success: function () {
                        var login_data = self.get_login_cache_info();
                        if (login_data == null) {
                            self.user_login(object, method, params);
                        } else {
                            self.get_user_login_info(object, method, params, login_data, auth_data);
                        }
                    },
                    fail: function () {
                        uni.removeStorageSync(self.data.cache_user_login_key);
                        self.user_login(object, method, params);
                    },
                });
                // #endif
                // #ifdef MP-ALIPAY
                var login_data = self.get_login_cache_info();
                if (login_data == null) {
                    self.user_login(object, method, params);
                } else {
                    self.get_user_login_info(object, method, params, login_data, auth_data);
                }
                // #endif
            },

            /**
             * 鐢ㄦ埛鐧诲綍
             * object     鍥炶皟鎿嶄綔瀵硅薄
             * method     鍥炶皟鎿嶄綔瀵硅薄鐨勫嚱鏁?
             * params     鍥炶皟鎿嶈姹傚弬鏁?
             */
            user_login(object, method, params) {
                var login_data = uni.getStorageSync(this.data.cache_user_login_key) || null;
                if (login_data == null) {
                    this.user_login_handle(object, method, params, true);
                } else {
                    this.login_to_auth();
                }
            },

            /**
             * 鐢ㄦ埛鐧诲綍澶勭悊
             * object     鍥炶皟鎿嶄綔瀵硅薄
             * method     鍥炶皟鎿嶄綔瀵硅薄鐨勫嚱鏁?
             * params     鍥炶皟鎿嶈姹傚弬鏁?
             * is_to_auth 鏄惁杩涘叆鎺堟潈
             */
            user_login_handle(object, method, params, is_to_auth = true) {
                var self = this;
                uni.showLoading({
                    title: i18n.t('common.auth_in_text'),
                });
                var action = 'login';
                // #ifdef MP-BAIDU
                action = 'getLoginCode';
                // #endif
                uni[action]({
                    success: (res) => {
                        if (res.code) {
                            uni.request({
                                url: self.get_request_url('appminiuserauth', 'user'),
                                method: 'POST',
                                data: {
                                    authcode: res.code,
                                },
                                dataType: 'json',
                                success: (res) => {
                                    uni.hideLoading();
                                    if (res.data.code == 0) {
                                        var data = res.data.data;
                                        var client_type = self.application_client_type();
                                        if ((data.is_user_exist || 0) == 1 || client_type == 'weixin') {
                                            // 瀛樺湪鏁版嵁闈炲井淇?鎴?寰俊灏忕▼搴忔槸鍚﹀己鍒跺～鍐欏熀纭€淇℃伅
                                            if(((data.is_user_exist || 0) == 1 && client_type != 'weixin') || !self.is_weixin_force_user_base_handle(self, data, object, method, params)) {
                                                uni.setStorageSync(self.data.cache_user_info_key, data);
                                                if (typeof object === 'object' && (method || null) != null) {
                                                    object[method](params);
                                                }
                                            }
                                        } else {
                                            uni.setStorageSync(self.data.cache_user_login_key, data);
                                            if (is_to_auth) {
                                                var pages = getCurrentPages();
                                                if (pages[pages.length - 1]['route'] == 'pages/login/login') {
                                                    if (typeof object === 'object' && (method || null) != null) {
                                                        object[method](params);
                                                    }
                                                } else {
                                                    self.login_to_auth();
                                                }
                                            }
                                        }
                                    } else {
                                        self.showToast(res.data.msg);
                                    }
                                },
                                fail: () => {
                                    uni.hideLoading();
                                    self.showToast(i18n.t('common.internet_error_tips'));
                                },
                            });
                        }
                    },
                    fail: (e) => {
                        uni.hideLoading();
                        self.showToast(i18n.t('login.login.3nmrg2'));
                    },
                });
            },

            // 寰俊灏忕▼搴忔槸鍚﹀己鍒跺～鍐欏熀纭€淇℃伅
            is_weixin_force_user_base_handle(self, data, object, method, params) {
                var status = parseInt(self.get_config('config.common_app_is_weixin_force_user_base', 0));
                if(status == 1) {
                    var obj = self.get_page_object();
                    if((obj.$vm || null) != null && (obj.$vm.$refs || null) != null && (obj.$vm.$refs.common || null) != null && (obj.$vm.$refs.common.$refs || null) != null && (obj.$vm.$refs.common.$refs.user_base || null) != null) {
                        var user_base = obj.$vm.$refs.common.$refs.user_base;
                        var res = user_base.form_write_field_check_data(data, true);
                        if(res.popup_status) {
                            user_base.user_base_open(object, method, params);
                        }
                        return res.popup_status;
                    }
                }
                return false;
            },

            /**
             * 璺宠浆鍒扮櫥褰曢〉闈㈡巿鏉?
             */
            login_to_auth() {
                uni.showModal({
                    title: i18n.t('common.warm_tips'),
                    content: i18n.t('login.login.jw378f'),
                    confirmText: i18n.t('common.confirm'),
                    cancelText: i18n.t('common.not_yet'),
                    success: (result) => {
                        if (result.confirm) {
                            uni.navigateTo({
                                url: '/pages/login/login',
                            });
                        }
                    },
                });
            },

            /**
             * 鑾峰彇鐢ㄦ埛鎺堟潈淇℃伅
             * object     鍥炶皟鎿嶄綔瀵硅薄
             * method     鍥炶皟鎿嶄綔瀵硅薄鐨勫嚱鏁?
             * params     鍥炶皟璇锋眰鍙傛暟
             * login_data 鐧诲綍淇℃伅
             * auth_data  鎺堟潈鏁版嵁
             */
            get_user_login_info(object, method, params, login_data, auth_data) {
                // 璇锋眰鏁版嵁
                var data = {
                    auth_data: JSON.stringify(auth_data),
                    openid: login_data.openid,
                    unionid: login_data.unionid,
                };
                // 鐢ㄦ埛淇℃伅澶勭悊
                uni.showLoading({
                    title: i18n.t('common.auth_in_text'),
                });
                var self = this;
                uni.request({
                    url: self.get_request_url('appminiuserinfo', 'user'),
                    method: 'POST',
                    data: data,
                    dataType: 'json',
                    success: (res) => {
                        uni.hideLoading();
                        if (res.data.code == 0) {
                            uni.setStorageSync(self.data.cache_user_info_key, res.data.data);
                            if (typeof object === 'object' && (method || null) != null) {
                                object[method](params);
                            }
                        } else {
                            self.showToast(res.data.msg);
                        }
                    },
                    fail: () => {
                        uni.hideLoading();
                        self.showToast(i18n.t('common.internet_error_tips'));
                    },
                });
            },

            /**
             * 瀛楁鏁版嵁鏍￠獙
             * data           寰呮牎楠岀殑鏁版嵁, 涓€缁磈son瀵硅薄
             * validation     寰呮牎楠岀殑瀛楁, 鏍煎紡 [{fields: 'mobile', msg: '璇峰～鍐欐墜鏈哄彿鐮?, is_can_zero: 1(鏄惁鍙互涓?)}, ...]
             */
            fields_check(data, validation) {
                for (var i in validation) {
                    var temp_value = data[validation[i]['fields']];
                    var temp_is_can_zero = validation[i]['is_can_zero'] || null;
                    if (temp_value == undefined || temp_value.length == 0 || temp_value == -1 || (temp_is_can_zero == null && temp_value == 0)) {
                        this.showToast(validation[i]['msg']);
                        return false;
                    }
                }
                return true;
            },

            /**
             * 鑾峰彇褰撳墠鏃堕棿鎴?
             */
            get_timestamp() {
                return parseInt(new Date().getTime() / 1000);
            },

            /**
             * 鑾峰彇鏃ユ湡
             * format       鏃ユ湡鏍煎紡锛堥粯璁?yyyy-MM-dd h:m:s锛?
             * timestamp    鏃堕棿鎴筹紙榛樿褰撳墠鏃堕棿鎴筹級
             */
            get_date(format, timestamp) {
                var d = new Date((timestamp || this.get_timestamp()) * 1000);
                var date = {
                    'M+': d.getMonth() + 1,
                    'd+': d.getDate(),
                    'h+': d.getHours(),
                    'm+': d.getMinutes(),
                    's+': d.getSeconds(),
                    'q+': Math.floor((d.getMonth() + 3) / 3),
                    'S+': d.getMilliseconds(),
                };
                if (/(y+)/i.test(format)) {
                    format = format.replace(RegExp.$1, (d.getFullYear() + '').substr(4 - RegExp.$1.length));
                }
                for (var k in date) {
                    if (new RegExp('(' + k + ')').test(format)) {
                        format = format.replace(RegExp.$1, RegExp.$1.length == 1 ? date[k] : ('00' + date[k]).substr(('' + date[k]).length));
                    }
                }
                return format;
            },

            /**
             * 鑾峰彇瀵硅薄銆佹暟缁勭殑闀垮害銆佸厓绱犱釜鏁?
             * obj      瑕佽绠楅暱搴︾殑鍏冪礌锛坥bject銆乤rray銆乻tring锛?
             */
            get_length(obj) {
                var obj_type = typeof obj;
                if (obj_type == 'string') {
                    return obj.length;
                } else if (obj_type == 'object') {
                    var obj_len = 0;
                    for (var i in obj) {
                        obj_len++;
                    }
                    return obj_len;
                }
                return false;
            },

            /**
             * 浠锋牸淇濈暀涓や綅灏忔暟
             * price      浠锋牸淇濈暀涓や綅灏忔暟
             */
            price_two_decimal(x) {
                var f_x = parseFloat(x);
                if (isNaN(f_x)) {
                    return 0;
                }
                var f_x = Math.round(x * 100) / 100;
                var s_x = f_x.toString();
                var pos_decimal = s_x.indexOf('.');
                if (pos_decimal < 0) {
                    pos_decimal = s_x.length;
                    s_x += '.';
                }
                while (s_x.length <= pos_decimal + 2) {
                    s_x += '0';
                }
                return s_x;
            },

            /**
             * url涓昏閮ㄥ垎
             * url url鍦板潃
             */
            get_url_main_part(url) {
                var value = '';
                if((url || null) != null) {
                    if (url.indexOf('?') == -1) {
                        value = url;
                    } else {
                        var temp_str = url.split('?');
                        value = temp_str[0];
                    }
                }
                return value;
            },

            // 涓€鏈熸敹鍙ｏ細褰撳墠璺敱鏄惁绂佺敤
            is_phase_one_disabled_route(url) {
                return is_phase_one_disabled_route_match(url);
            },

            // 涓€鏈熸敹鍙ｏ細璺敱鎷︽埅锛堝懡涓悗鎻愮ず骞朵腑鏂烦杞級
            phase_one_route_guard(url, is_toast = true) {
                if (this.is_phase_one_disabled_route(url)) {
                    if (is_toast) {
                        this.showToast('Feature is disabled in phase 1');
                    }
                    return true;
                }
                return false;
            },

            /**
             * diy搴曢儴鑿滃崟楂樺害鏁版嵁瀛樺偍
             * value  楂樺害
             */
            app_diy_tabbar_height_save(value) {
                uni.setStorageSync(this.data.cache_app_diy_tabbar_height_key, value);
            },

            /**
             * diy搴曢儴鑿滃崟楂樺害鏁版嵁璇诲彇
             */
            app_diy_tabbar_height_value() {
                return parseInt(uni.getStorageSync(this.data.cache_app_diy_tabbar_height_key) || 0);
            },

            /**
             * 绯荤粺搴曢儴鑿滃崟楂樺害鏁版嵁瀛樺偍
             * value  楂樺害
             */
            app_system_tabbar_height_save(value) {
                uni.setStorageSync(this.data.cache_app_system_tabbar_height_key, value);
            },
            
            /**
             * 绯荤粺搴曢儴鑿滃崟楂樺害鏁版嵁璇诲彇
             */
            app_system_tabbar_height_value() {
                return parseInt(uni.getStorageSync(this.data.cache_app_system_tabbar_height_key) || 0);
            },

            /**
             * 搴曢儴鑿滃崟椤甸潰鏁般€乼abbar
             */
            app_tabbar_pages() {
                var temp_tabbar = this.data.system_tabbar;
                if(this.data.is_use_native_tabbar == 0) {
                    var app_tabbar = this.get_config('app_tabbar') || null;
                    if(app_tabbar != null && (app_tabbar.content || null) != null && (app_tabbar.content.nav_content || null) != null) {
                        temp_tabbar = app_tabbar.content.nav_content.map(function(v) {
                            if((v.link || null) != null && (v.link.page || null) != null) {
                                return v.link.page;
                            }
                        });
                    }
                }
                return temp_tabbar;
            },

            /**
             * 褰撳墠鍦板潃鏄惁瀛樺湪搴曢儴鑿滃崟tabbar涓?
             */
            is_tabbar_pages(url = null) {
                var pages = (this.data.is_use_native_tabbar == 1) ? this.data.system_tabbar : this.app_tabbar_pages();
                return this.is_tabbar_pages_handle(pages, url);
            },

            /**
             * 褰撳墠鍦板潃鏄惁瀛樺湪绯荤粺tabbar涓?
             */
            is_system_tabbar_pages(url = null) {
                return this.is_tabbar_pages_handle(this.data.system_tabbar, url);
            },

            /**
             * 褰撳墠鍦板潃鏄惁瀛樺湪tabbar涓?
             * pages  tabbar椤甸潰
             * url    url鍦板潃
             */
            is_tabbar_pages_handle(pages, url = null) {
                var value = (url == null) ? '/'+this.current_page() : url;
                if ((value || null) != null) {
                    if(pages.indexOf(value) != -1) {
                        return true;
                    } else {
                        // 瀛樺湪鍙傛暟锛屽幓鎺夊弬鏁板啀妫€绱㈡槸鍚﹀瓨鍦ㄩ〉闈㈢殑tabbar
                        if(value.indexOf('?') != -1) {
                            var temp = value.split('?');
                            if(pages.indexOf(temp[0]) != -1) {
                                return true;
                            }
                        }
                    }
                }
                return false;
            },

            /**
             * 褰撳墠鍦板潃鏄惁瀛樹负棣栭〉
             * url    url鍦板潃
             */
            is_tabbar_home(url = null) {
                var pages = this.app_tabbar_pages() || [];
                if(pages.length > 0) {
                    var value = (url == null) ? '/'+this.current_page() : url;
                    if ((value || null) != null) {
                        if(pages[0] == value) {
                            return true;
                        } else {
                            // 瀛樺湪鍙傛暟锛屽幓鎺夊弬鏁板啀妫€绱㈡槸鍚﹀瓨鍦ㄩ〉闈㈢殑tabbar
                            if(value.indexOf('?') != -1) {
                                var temp = value.split('?');
                                if(pages[0] == temp[0]) {
                                    return true;
                                }
                            }
                        }
                    }
                }
                return false;
            },

            // 绯荤粺搴曢儴鑿滃崟闅愯棌
            system_hide_tabbar() {
                if(this.data.is_use_native_tabbar != 1) {
                    uni.hideTabBar();
                }
            },

            /**
             * 浜嬩欢鎿嶄綔
             */
            operation_event(e) {
                var value = e.currentTarget.dataset.value || null;
                var type = parseInt(e.currentTarget.dataset.type);
                if (value != null) {
                    switch (type) {
                        // web
                        case 0:
                            this.open_web_view(value);
                            break;
                        // 鍐呴儴椤甸潰
                        case 1:
                            if (this.phase_one_route_guard(value)) {
                                return false;
                            }
                            if (this.is_system_tabbar_pages(value)) {
                                var temp = value.split('?');
                                if (temp.length > 1 && (temp[1] || null) != null) {
                                    value = temp[0];
                                    var query = this.url_params_to_json(temp[1]);
                                    uni.setStorageSync(this.data.cache_page_tabbar_switch_params, query);
                                }
                                uni.switchTab({
                                    url: value
                                });
                                //闅愯棌绯荤粺tabbar
                                this.system_hide_tabbar();
                            } else {
                                uni.navigateTo({
                                    url: value
                                });
                            }
                            break;
                        // 璺宠浆鍒板閮ㄥ皬绋嬪簭
                        case 2:
                            // 鎵撳紑澶栭儴灏忕▼搴忓崗璁紙appid|/pages/index/index?pv=hello|extraData|envVersion锛?
                            var values = value.split('|');
                            uni.navigateToMiniProgram({
                                appId: values[0],
                                path: values[1] || '',
                                extraData: values[2] || '',
                                envVersion: values[3] || 'release'
                            });
                            break;
                        // 璺宠浆鍒板湴鍥炬煡鐪嬩綅缃?
                        case 3:
                            var values = value.split('|');
                            if (values.length != 4) {
                                this.showToast(i18n.t('shopxo-uniapp.app.5y1c52'));
                                return false;
                            }
                            this.open_location(values[2], values[3], values[0], values[1]);
                            break;
                        // 鎷ㄦ墦鐢佃瘽
                        case 4:
                            this.call_tel(value);
                            break;
                    }
                }
            },

            /**
             * 鎵撳紑 webview椤甸潰
             * value       [string]  url鍦板潃
             * is_redirect [boolean] 鏄惁鍏抽棴褰撳墠椤甸潰
             */
            open_web_view(value, is_redirect = false) {
                var url = '/pages/web-view/web-view?url=' + encodeURIComponent(value);
                if(is_redirect) {
                    uni.redirectTo({
                        url: url,
                    });
                } else {
                    uni.navigateTo({
                        url: url,
                    });
                }
            },

            /**
             * 榛樿寮辨彁绀烘柟娉?
             * msg    [string]  鎻愮ず淇℃伅
             * status [string]  鐘舵€?榛樿error [姝ｇ‘success, 閿欒error]
             */
            showToast(msg, status) {
                if ((msg || null) != null) {
                    if ((status || 'error') == 'success') {
                        uni.showToast({
                            icon: 'success',
                            title: msg,
                            duration: 3000,
                        });
                    } else {
                        uni.showToast({
                            icon: 'none',
                            title: msg,
                            duration: 3000,
                        });
                    }
                }
            },

            /**
             * alert纭妗?
             * title              [string]    鏍囬锛堥粯璁ょ┖锛?
             * msg                [string]    鎻愮ず淇℃伅锛屽繀浼?
             * is_show_cancel     [int]       鏄惁鏄剧ず鍙栨秷鎸夐挳锛堥粯璁ゆ樉绀?0鍚? 1|undefined鏄級
             * cancel_text        [string]    鍙栨秷鎸夐挳鏂囧瓧锛堥粯璁?鍙栨秷锛?
             * cancel_color       [string]    鍙栨秷鎸夐挳鐨勬枃瀛楅鑹诧紝蹇呴』鏄?16 杩涘埗鏍煎紡鐨勯鑹插瓧绗︿覆锛堥粯璁?#000000锛?
             * confirm_text       [string]    纭鎸夐挳鏂囧瓧锛堥粯璁?纭锛?
             * confirm_color      [string]    纭鎸夐挳鐨勬枃瀛楅鑹诧紝蹇呴』鏄?16 杩涘埗鏍煎紡鐨勯鑹插瓧绗︿覆锛堥粯璁?#000000锛?
             * object             [boject]    鍥炶皟鎿嶄綔瀵硅薄锛岀偣鍑荤‘璁ゅ洖璋冨弬鏁?锛屽彇娑堝洖璋?
             * method             [string]    鍥炶皟鎿嶄綔瀵硅薄鐨勫嚱鏁?
             * params             [obj]       鎼哄甫鐨勫弬鏁?
             */
            alert(e) {
                var msg = e.msg || null;
                if (msg != null) {
                    var title = e.title || '';
                    var is_show_cancel = e.is_show_cancel == 0 ? false : true;
                    var cancel_text = e.cancel_text || i18n.t('common.cancel');
                    var confirm_text = e.confirm_text || i18n.t('common.confirm');
                    var cancel_color = e.cancel_color || '#000000';
                    var confirm_color = e.confirm_color || '#576B95';
                    var params = e.params || {};
                    uni.showModal({
                        title: title,
                        content: msg,
                        showCancel: is_show_cancel,
                        cancelText: cancel_text,
                        cancelColor: cancel_color,
                        confirmText: confirm_text,
                        confirmColor: confirm_color,
                        success(res) {
                            if ((e.object || null) != null && typeof e.object === 'object' && (e.method || null) != null) {
                                params['alert_status'] = res.confirm ? 1 : 0;
                                e.object[e.method](params);
                            }
                        },
                    });
                } else {
                    self.showToast(i18n.t('shopxo-uniapp.app.t754n6'));
                }
            },

            // url鍙傛暟杞琷son瀵硅薄
            url_params_to_json(url_params) {
                var json = new Object();
                if ((url_params || null) != null) {
                    var arr = url_params.split('&');
                    for (var i = 0; i < arr.length; i++) {
                        var temp = arr[i].split('=');
                        json[temp[0]] = temp[1];
                    }
                }
                return json;
            },

            // json瀵硅薄杞瑄rl璇锋眰鍙傛暟
            json_to_url_params(data) {
                var str = '';
                for (var i in data) {
                    if (str != '') {
                        str += '&';
                    }
                    str += i + '=' + data[i];
                }
                return str;
            },

            // 鎷ㄦ墦鐢佃瘽
            call_tel(data) {
                var value = typeof data == 'object' ? data.currentTarget.dataset.value || null : data || null;
                if (value != null) {
                    uni.makePhoneCall({
                        phoneNumber: value.toString(),
                    });
                }
            },

            /**
             * 鐧诲綍鏍￠獙
             * object     鍥炶皟鎿嶄綔瀵硅薄
             * method     鍥炶皟鎿嶄綔瀵硅薄鐨勫嚱鏁?
             * params     鍥炶皟璇锋眰鍙傛暟
             */
            is_login_check(res, object, method, params) {
                if (res.code == -400) {
                    uni.clearStorage();
                    this.get_user_info(object, method, params);
                    return false;
                }
                return true;
            },

            /**
             * 璇诲彇搴曢儴瀵艰埅badge
             * type     绫诲瀷鏍囪瘑锛堝璐墿杞?cart锛?
             */
            get_tab_bar_badge(type) {
                if ((type || null) != null) {
                    return uni.getStorageSync(this.data.cache_tabbar_badge_key+'-'+type) || null;
                }
                return null;
            },

            /**
             * 璁剧疆搴曢儴瀵艰埅badge
             * type     绫诲瀷鏍囪瘑锛堝璐墿杞?cart锛?
             * value    鏄剧ず鐨勬枃鏈紝瓒呰繃 4 涓瓧绗﹀垯鏄剧ず鎴?...锛坱ype鍙傛暟涓?鐨勬儏鍐典笅鏈夋晥锛?
             */
            set_tab_bar_badge(type, value = 0) {
                // 鏄惁浣跨敤鍘熺敓鑿滃崟
                if(this.data.is_use_native_tabbar == 1) {
                    if(type == 'cart') {
                        if ((value || 0) == 0) {
                            uni.removeTabBarBadge({
                                index: 2
                            });
                        } else {
                            uni.setTabBarBadge({
                                index: 2,
                                text: value.toString()
                            });
                        }
                    }
                } else {
                    // 鏁版嵁澶勭悊
                    if ((type || null) != null) {
                        var key = this.data.cache_tabbar_badge_key+'-'+type;
                        if ((value || null) == null) {
                            uni.removeStorageSync(key);
                        } else {
                            uni.setStorageSync(key, value);
                        }
                    }
                    // 鏇存柊搴曢儴鑿滃崟鏁版嵁
                    var obj = this.get_page_object() || null;
                    if(obj != null && (obj.$vm || null) != null && (obj.$vm.$refs || null) != null && (obj.$vm.$refs.common || null) != null) {
                        obj.$vm.$refs.common.footer_init();
                    }
                }
            },

            // 椤甸潰鍒嗕韩澶勭悊
            page_share_handle(share = null) {
                // 褰撳墠椤甸潰
                var pages = getCurrentPages();
                var obj = pages[pages.length - 1] || null;
                // 鍒嗕韩淇℃伅銆佹槸鍚︽寚瀹氬弬鏁?
                if ((share || null) == null) {
                    share = {};
                }
                // 浠庨〉闈㈠璞¤幏鍙栧弬鏁?
                if (obj != null && Object.keys(share).length <= 0) {
                    share = obj.share_info || {};
                }
                // 鍙傛暟澶勭悊
                share = this.share_content_handle(share);
                // #ifdef MP-WEIXIN
                // 寰俊灏忕▼搴忓睍绀虹郴缁熷垎浜ソ鍙嬪拰鏈嬪弸鍦堟寜閽?
                // 鍏朵粬绔皬绋嬪簭涓嶇敤灞曠ず浼氳皟璧峰垎浜獥鍙?
                var not_pages = ['/pages/user/user', '/pages/cart/cart'];
                if (not_pages.indexOf(share.url) == -1) {
                    uni.showShareMenu({
                        withShareTicket: true,
                        title: share.title,
                        desc: share.desc,
                        path: share.path + share.query,
                        imageUrl: share.img,
                        menus: ['shareAppMessage', 'shareTimeline'],
                    });
                } else {
                    wx.hideShareMenu({
                        menus: ['shareTimeline'],
                    });
                }
                // #endif
                // #ifdef H5
                // H5澶勭悊寰俊鐜鍒嗕韩鑷畾涔変俊鎭?
                if (this.is_weixin_env()) {
                    var page_url = this.get_page_url();
                    uni.request({
                        url: this.get_request_url('signpackage', 'index', 'share'),
                        method: 'POST',
                        data: {
                            url: encodeURIComponent(page_url),
                        },
                        dataType: 'json',
                        success: (res) => {
                            if (res.data.code == 0 && (res.data.data.package || null) != null) {
                                var data = res.data.data.package;
                                var wx = require('jweixin-module');
                                wx.config({
                                    debug: false,
                                    appId: data.appId,
                                    timestamp: data.timestamp,
                                    nonceStr: data.nonceStr,
                                    signature: data.signature,
                                    jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData', 'onMenuShareWeibo'],
                                });
                                wx.ready(function () {
                                    // 鑷畾涔夆€滃垎浜粰鏈嬪弸鈥濆強鈥滃垎浜埌QQ鈥濇寜閽殑鍒嗕韩鍐呭
                                    wx.updateAppMessageShareData({
                                        title: share.title,
                                        desc: share.desc,
                                        link: share.url,
                                        imgUrl: share.img,
                                    });
                                    // 鑷畾涔夆€滃垎浜埌鏈嬪弸鍦堚€濆強鈥滃垎浜埌QQ绌洪棿鈥濇寜閽殑鍒嗕韩鍐呭
                                    wx.updateTimelineShareData({
                                        title: share.title,
                                        link: share.url,
                                        imgUrl: share.img,
                                    });
                                    // 鑾峰彇鈥滃垎浜埌鑵捐寰崥鈥濇寜閽偣鍑荤姸鎬佸強鑷畾涔夊垎浜唴瀹规帴鍙?
                                    wx.onMenuShareWeibo({
                                        title: share.title,
                                        desc: share.desc,
                                        link: share.url,
                                        imgUrl: share.img,
                                    });
                                });
                            }
                        },
                        fail: () => {
                            this.showToast(i18n.t('common.internet_error_tips'));
                        },
                    });
                }
                // #endif
                // #ifdef MP-BAIDU
                // 鐧惧害灏忕▼搴弚ab鍖栨悳绱㈠紩鎿庢暟鎹缃?
                uni.setPageInfo({
                    title: share.title,
                    keywords: share.kds || share.desc,
                    articleTitle: share.title,
                    description: share.desc,
                    image: share.img,
                    video:
                        (share.video || null) == null
                            ? []
                            : [
                                  {
                                      url: share.video,
                                      duration: '100',
                                      image: share.img,
                                  },
                              ],
                });
                // #endif
            },
            
            /**
             * 鏁版嵁銆佸彲鎸囧畾key鍜岄粯璁ゅ€?
             * data             鏁版嵁
             * key              鏁版嵁key锛堟敮鎸佸绾ц鍙栥€佷互 . 鍒嗗壊key鍚嶇О锛?
             * default_value    榛樿鍊?
             */
            get_key_data(data, key, default_value = null) {
                var value = default_value;
                if ((data || null) != null) {
                    var arr = key.split('.');
                    if (arr.length == 1) {
                        if(data[key] != undefined) {
                            value = data[key];
                        }
                    } else {
                        value = data;
                        for (var i in arr) {
                            if (value[arr[i]] != undefined) {
                                value = value[arr[i]];
                            } else {
                                value = default_value;
                                break;
                            }
                        }
                    }
                }
                return value;
            },

            /**
             * 鑾峰彇閰嶇疆淇℃伅銆佸彲鎸囧畾key鍜岄粯璁ゅ€?
             * key              鏁版嵁key锛堟敮鎸佸绾ц鍙栥€佷互 . 鍒嗗壊key鍚嶇О锛?
             * default_value    榛樿鍊?
             */
            get_config(key, default_value) {
                // 鑾峰彇鍏ㄩ儴缂撳瓨
                var config = uni.getStorageSync(this.data.cache_config_info_key) || null;
                if((key || null) == null) {
                    return config;
                }

                // key缂撳瓨鑾峰彇
                var value = null;
                if (config != null) {
                    // 鏁版嵁璇诲彇
                    var arr = key.split('.');
                    if (arr.length == 1) {
                        value = config[key] == undefined ? null : config[key];
                    } else {
                        value = config;
                        for (var i in arr) {
                            if (value[arr[i]] != undefined) {
                                value = value[arr[i]];
                            } else {
                                value = null;
                                break;
                            }
                        }
                    }
                }
                // 榛樿鍊?
                if (value == null && default_value != undefined) {
                    value = default_value;
                }
                // 鏃犳暟鎹垯澶勭悊鑷畾涔夊瓧娈靛畾涔夌殑鏁版嵁
                if (value == null) {
                    switch (key) {
                        // 璐у竵绗﹀彿
                        case 'currency_symbol':
                            value = this.data.currency_symbol;
                            break;
                    }
                }
                return value;
            },

            /**
             * 鍒濆鍖?閰嶇疆淇℃伅
             * num        璇诲彇娆℃暟銆佸鏋滃け璐?1鍐嶆璇诲彇
             * object     鍥炶皟鎿嶄綔瀵硅薄
             * method     鍥炶皟鎿嶄綔瀵硅薄鐨勫嚱鏁?
             * params     鍥炶皟鎿嶈姹傚弬鏁?
             */
            init_config(num = 0, object, method, params) {
                var self = this;
                if (num == 0) {
                    self.data.common_data_init_config_back_list.push({ object: object, method: method, params: params})
                }
                uni.getNetworkType({
                    success: function (res) {
                        if (res.networkType != 'none') {
                            // 鑾峰彇閰嶇疆鏈湴缂撳瓨
                            var config = self.get_config();
                            if(config != null) {
                                // 鍏叡閰嶇疆鍒濆鍖栬繑鍥炲鐞?
                                self.init_config_result_handle(config, self);
                            }
                            // 璇诲彇杩滅▼閰嶇疆
                            if(self.data.common_data_loading_status == 0) {
                                // 璧嬪€煎湪鍔犺浇鐘舵€?
                                self.data.common_data_loading_status = 1;
                                uni.request({
                                    url: self.get_request_url('common', 'base'),
                                    method: 'POST',
                                    data: {
                                        is_key: 1,
                                    },
                                    dataType: 'json',
                                    success: (res) => {
                                        // 璧嬪€间笉鍦ㄥ姞杞界姸鎬?
                                        self.data.common_data_loading_status = 0;
                                        if (res.data.code == 0) {
                                            // 閰嶇疆瀛樺偍
                                            var data = res.data.data;
                                            uni.setStorageSync(self.data.cache_config_info_key, data);

                                            // 鍏叡閰嶇疆鍒濆鍖栬繑鍥炲鐞?
                                            self.init_config_result_handle(data, self);
                                            // 鍥炶皟
                                            if (self.data.common_data_init_config_back_list.length > 0) {
                                                self.data.common_data_init_config_back_list.forEach(item => {
                                                    if (typeof item.object === 'object' && (item.method || null) != null) {
                                                        item.object[item.method](item.params);
                                                    }
                                                })
                                                self.data.common_data_init_config_back_list = [];
                                            }
                                        } else {
                                            self.showToast(res.data.msg);
                                            // 绔欑偣鍏抽棴鐘舵€佸垯 璁板綍宸插垵濮嬪寲鍏叡鏁版嵁鐘舵€?
                                            if (res.data.code == -10000) {
                                                self.data.common_data_init_status = 1;
                                            }
                                            // 棣栨鍒欏啀娆″垵濮嬪寲閰嶇疆銆佺珯鐐瑰叧闂姸鎬佸垯涓嶅鐞?
                                            if (parseInt(num || 0) <= 20 && self.data.common_data_init_status == 0) {
                                                self.init_config(num+1, object, method, params);
                                            }
                                        }
                                    },
                                    fail: () => {
                                        // 璧嬪€间笉鍦ㄥ姞杞界姸鎬?
                                        self.data.common_data_loading_status = 0;
                                        // 棣栨鍒欏啀娆″垵濮嬪寲閰嶇疆
                                        if (parseInt(num || 0) <= 20) {
                                            self.init_config(num+1, object, method, params);
                                        }
                                    },
                                });
                            }
                        }
                    },
                });
            },

            // 鍏叡閰嶇疆鍒濆鍖栬繑鍥炲鐞?
            init_config_result_handle(data, self) {
                // 璁板綍宸插垵濮嬪寲鍏叡鏁版嵁鐘舵€?
                self.data.common_data_init_status = 1;

                // 涓婚璁剧疆
                self.set_theme_value(data.plugins_themestyle_data);

                // 璁剧疆搴曢儴鑿滃崟銆佸瓨鍦ㄥ紑灞忓箍鍛婂垯寤惰繜鍔犺浇
                if(this.data.is_use_native_tabbar == 1) {
                    if(this.is_init_config_success_pages_begin(self)) {
                        setTimeout(function() {
                            self.set_tabbar(data.plugins_themestyle_data);
                        }, 500);
                    } else {
                        self.set_tabbar(data.plugins_themestyle_data);
                    }
                }

                // 鐢ㄦ埛鑷姩鐧诲綍澶勭悊
                self.user_auto_login_handle();
            },

            // 鏄惁鍒濆鍖栭厤缃垚鍔熷悗锛岄〉闈㈠墠澶勭悊锛岃繑鍥瀟rue鍒欓〉闈㈤渶瑕佸欢杩熷姞杞?
            is_init_config_success_pages_begin(self = this) {
                // 鏄惁瀛樺湪寮€灞忓箍鍛婃彃浠?
                return this.is_plugins_startad_status(self);
            },

            // 鏄惁瀛樺湪寮€灞忓箍鍛婃彃浠?
            is_plugins_startad_status(self = this) {
                // 鏄惁鏈夊紑灞忓箍鍛?
                let pages = self.app_tabbar_pages() || [];
                let current_page = '/'+self.current_page(false);
                if(pages.length > 0 && pages[0] == current_page) {
                    let base = self.get_config('plugins_base.startad.data') || {};
                    let data = self.get_config('plugins_startad_list') || [];
                    if(data.length > 0 && parseInt(base.is_status || 0) == 1) {
                        return true;
                    }
                }
                return false;
            },

            /**
             * 閰嶇疆鏄惁鏈夋晥(100姣妫€楠屼竴娆°€佹渶澶氭楠?00娆?
             * object     鍥炶皟鎿嶄綔瀵硅薄
             * method     鍥炶皟鎿嶄綔瀵硅薄鐨勫嚱鏁?
             * params     鍥炶皟鎿嶈姹傚弬鏁?
             */
            is_config(object, method, params) {
                var self = this;
                var count = 0;
                var is_config_count = 0;
                var timer = setInterval(function () {
                    if (self.get_config('status') == 1) {
                        clearInterval(timer);
                        if (typeof object === 'object' && (method || null) != null) {
                            object[method](true, params);
                        }
                    }
                    count++;
                    if (count >= 2300) {
                        clearInterval(timer);
                    }
                }, 100);
            },

            /**
             * 鐏槦鍧愭爣GCJ02鍒扮櫨搴﹀潗鏍嘊D-09(楂樺痉锛岃胺姝岋紝鑵捐鍧愭爣 -> 鐧惧害)
             * lng     缁忓害
             * lat     绾害
             */
            map_gcj_to_bd(lng, lat) {
                lng = parseFloat(lng);
                lat = parseFloat(lat);
                let x_pi = (3.14159265358979324 * 3000.0) / 180.0;
                let x = lng;
                let y = lat;
                let z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * x_pi);
                let theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * x_pi);
                let lngs = z * Math.cos(theta) + 0.0065;
                let lats = z * Math.sin(theta) + 0.006;
                return {
                    lng: lngs,
                    lat: lats,
                };
            },

            /**
             * 鐧惧害鍧愭爣BD-09鍒扮伀鏄熷潗鏍嘒CJ02(鐧惧害 -> 楂樺痉锛岃胺姝岋紝鑵捐鍧愭爣)
             * lng     缁忓害
             * lat     绾害
             */
            map_bd_to_gcj(lng, lat) {
                lng = parseFloat(lng);
                lat = parseFloat(lat);
                let x_pi = (3.14159265358979324 * 3000.0) / 180.0;
                let x = lng - 0.0065;
                let y = lat - 0.006;
                let z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * x_pi);
                let theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * x_pi);
                let lngs = z * Math.cos(theta);
                let lats = z * Math.sin(theta);
                return {
                    lng: lngs,
                    lat: lats,
                };
            },

            /**
             * 鎵撳紑鍦板浘
             * lng        缁忓害
             * lat        绾害
             * name       鍦板浘涓婇潰鏄剧ず鐨勫悕绉?
             * address    鍦板浘涓婇潰鏄剧ず鐨勮缁嗗湴鍧€
             * scale      缂╂斁姣斾緥锛岃寖鍥?~18
             */
            open_location(lng, lat, name, address, scale) {
                // #ifdef MP-KUAISHOU
                this.showToast(i18n.t('shopxo-uniapp.app.iq66pg'));
                return false;
                // #endif

                // 鍙傛暟鍒ゆ柇
                if (lng == undefined || lat == undefined || lng == '' || lat == '') {
                    this.showToast(i18n.t('shopxo-uniapp.app.v2j475'));
                    return false;
                }
                lat = parseFloat(lat);
                lng = parseFloat(lng);

                // #ifdef MP-WEIXIN
                // 寰俊灏忕▼搴忎娇鐢ㄣ€愯吘璁綅缃湇鍔¤矾绾胯鍒掋€戞彃浠?
                if (this.data.is_weixin_open_location_use_plugins == 1) {
                    var key = this.get_config('config.common_tencent_map_ak') || null;
                    if (key != null) {
                        var plugin = requirePlugin('routePlan');
                        var end_point = JSON.stringify({
                            name: name || i18n.t('extraction-apply.extraction-apply.47v7m0'),
                            longitude: lng,
                            latitude: lat,
                        });
                        uni.navigateTo({
                            url: 'plugin://routePlan/route-plan?key=' + key + '&referer=' + this.get_application_title() + '&endPoint=' + end_point + '&themeColor=' + this.get_theme_color() + '&navigation=1',
                        });
                        return false;
                    }
                }
                // #endif
                // 杞崲鍧愭爣鎵撳紑浣嶇疆
                uni.openLocation({
                    name: name || i18n.t('extraction-apply.extraction-apply.47v7m0'),
                    address: address || '',
                    scale: scale || 18,
                    longitude: lng,
                    latitude: lat,
                });
            },

            // uuid鐢熸垚
            uuid() {
                var d = new Date().getTime();
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = (d + Math.random() * 16) % 16 | 0;
                    d = Math.floor(d / 16);
                    return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
                });
            },

            // 鑾峰彇褰撳墠uuid
            request_uuid() {
                var uuid = uni.getStorageSync(this.data.cache_user_uuid_key) || null;
                if (uuid == null) {
                    uuid = this.uuid();
                    uni.setStorage({
                        key: this.data.cache_user_uuid_key,
                        data: uuid,
                        fail: () => {
                            this.showToast(i18n.t('shopxo-uniapp.app.3m1gbe'));
                        },
                    });
                }
                return uuid;
            },

            // 閾炬帴鍦板潃浜嬩欢
            url_event(e) {
                if((e.currentTarget || null) != null && (e.currentTarget.dataset || null) != null) {
                    // 闇€瑕佹墦寮€鐨剈rl鍦板潃
                    var value = e.currentTarget.dataset.value || null;

                    // 鏄惁闃绘鍟嗗搧椤甸潰鎵撳紑
                    if (this.data.is_forbid_to_goods_detail == 1 && value.indexOf('/pages/goods-detail/goods-detail') != -1) {
                        return false;
                    }

                    // 鏄惁鍏抽棴褰撳墠椤甸潰
                    var is_redirect = parseInt(e.currentTarget.dataset.redirect || 0) == 1;

                    // 濡傛灉鏄簳閮ㄨ彍鍗曪紝闈炵郴缁熷唴缃彍鍗曞垯鍏抽棴褰撳墠椤甸潰骞舵墦寮€
                    var tabbar = this.app_tabbar_pages();
                    if(tabbar.indexOf(value) != -1 && this.data.system_tabbar.indexOf(value) == -1) {
                        var page = this.prev_page();
                        if(page != null && this.data.system_tabbar.indexOf(page) == -1) {
                            is_redirect = true;
                        }
                    }

                    // 璋冪敤鎵撳紑url鏂规硶
                    this.url_open(value, is_redirect);
                }
            },

            // 鏄惁涓簎rl鍦板潃
            is_url(value) {
                var arr = ['http:/', 'https:'];
                return arr.indexOf(value.substr(0, 6)) != -1;
            },

            // 鏄惁涓簆age椤甸潰鍦板潃
            is_page(value) {
                var arr = ['/pages', 'pages/'];
                return arr.indexOf(value.substr(0, 6)) != -1;
            },

            // url鎵撳紑
            url_open(value, is_redirect = false) {
                if ((value || null) != null) {
                    // #ifdef MP
                    // 灏忕▼搴忔渶澶氭墦寮€10灞傞〉闈?
                    var pages = getCurrentPages();
                    if(pages.length >= 10) {
                        is_redirect = true;
                    }
                    // #endif

                    if (this.is_page(value) && this.phase_one_route_guard(value)) {
                        return false;
                    }

                    if (this.is_url(value)) {
                        // web鍦板潃
                        this.open_web_view(value, is_redirect);
                    } else if (value.substr(0, 8) == 'appid://') {
                        // 鎵撳紑澶栭儴灏忕▼搴忓崗璁紙appid|/pages/index/index?pv=hello|extraData|envVersion锛?
                        var values = value.substr(8).split('|');
                        uni.navigateToMiniProgram({
                            appId: values[0],
                            path: values[1] || '',
                            extraData: values[2] || '',
                            envVersion: values[3] || 'release'
                        });
                    } else if (value.substr(0, 12) == 'shortlink://') {
                        // 灏忕▼搴忓垎浜摼鎺?
                        uni.navigateToMiniProgram({
                            shortLink: value.substr(12)
                        });
                    } else if (value.substr(0, 6) == 'map://') {
                        // 鍦板浘鍗忚锛堝悕绉皘鍦板潃|lng|lat锛?
                        var values = value.substr(6).split('|');
                        if (values.length != 4) {
                            this.showToast(i18n.t('shopxo-uniapp.app.5y1c52'));
                            return false;
                        }
                        this.open_location(values[2], values[3], values[0], values[1]);
                    } else if (value.substr(0, 6) == 'tel://') {
                        // 鐢佃瘽鍗忚
                        this.call_tel(value.substr(6));
                    } else if (value.substr(0, 7) == 'scan://') {
                        // 鎵爜鍗忚
                        this.scan_handle();
                    } else if(value.substr(0, 17) == 'plugin-private://') {
                        // 鏄惁鎵撳紑鎻掍欢鍦板潃
                        // #ifdef APP
                        // APP鍒欑洿鎺ユ墦寮€寰俊灏忕▼搴忕洿鎾?
                        var self = this;
                        var weixin_original_id = self.get_config('config.common_app_mini_weixin_share_original_id', null);
                        if(weixin_original_id != null) {
                            plus.share.getServices(res => {
                                let sweixin = null;
                                for(let i in res) {
                                    if(res[i].id == 'weixin') {
                                        sweixin = res[i];
                                        break;
                                    }
                                }
                                //鍞ら啋寰俊灏忕▼搴?
                                if(sweixin) {
                                    sweixin.launchMiniProgram({
                                        id: weixin_original_id,
                                        type: 0,
                                        path: value
                                    });
                                } else {
                                    self.showToast(i18n.t('detail.detail.86g7e1'));
                                }
                            });
                        } else {
                            self.showToast(i18n.t('detail.detail.567uyh'));
                        }
                        return false;
                        // #endif

                        // #ifdef MP-WEIXIN
                        if (is_redirect) {
                            uni.redirectTo({
                                url: value
                            });
                        } else {
                            uni.navigateTo({
                                url: value
                            });
                        }
                        return false;
                        // #endif

                        // 闈炲井淇＄幆澧冨拰APP鐜
                        this.showToast(i18n.t('detail.detail.9d3o6w'));
                    } else {
                        // 榛樿鍒囨崲鎴栬烦杞〉闈?
                        if (this.is_page(value)) {
                            if (this.is_system_tabbar_pages(value)) {
                                var temp = value.split('?');
                                if (temp.length > 1 && (temp[1] || null) != null) {
                                    value = temp[0];
                                    var query = this.url_params_to_json(temp[1]);
                                    uni.setStorageSync(this.data.cache_page_tabbar_switch_params, query);
                                }
                                uni.switchTab({
                                    url: value
                                });
                                //闅愯棌绯荤粺tabbar
                                this.system_hide_tabbar();
                            } else {
                                if (is_redirect) {
                                    uni.redirectTo({
                                        url: value
                                    });
                                } else {
                                    uni.navigateTo({
                                        url: value
                                    });
                                }
                            }
                        } else {
                            this.url_open('/pages/goods-search/goods-search?keywords='+value);
                        }
                    }
                }
            },

            // 鏂囨湰浜嬩欢
            text_event_handle(e) {
                var event = e.currentTarget.dataset.event || null;
                if (event != null) {
                    var value = e.currentTarget.dataset.value;
                    switch (event) {
                        // 鎷ㄦ墦鐢佃瘽
                        case 'tel':
                            this.call_tel(value);
                            break;
                        // 澶嶅埗鏂囨湰
                        case 'copy':
                            this.text_copy_event(value);
                            break;
                    }
                }
            },

            // 鍓创鏉?
            text_copy_event(data) {
                var value = typeof data == 'object' ? data.currentTarget.dataset.value || null : data || null;
                if (value != null) {
                    var self = this;
                    uni.setClipboardData({
                        data: value,
                        success(res) {
                            uni.getClipboardData({
                                success(res) {
                                    self.showToast(i18n.t('shopxo-uniapp.app.r5ts62'), 'success');
                                },
                            });
                        },
                    });
                } else {
                    this.showToast(i18n.t('shopxo-uniapp.app.r539kf'));
                }
            },

            // 鍥剧墖棰勮
            image_show_event(e, urls = null) {
                var value = e.currentTarget.dataset.value || null;
                if (value != null) {
                    uni.previewImage({
                        current: value,
                        urls: urls || [value],
                    });
                } else {
                    this.showToast(i18n.t('shopxo-uniapp.app.qm8548'));
                }
            },

            // 闈欐€佹枃浠秛rl鍦板潃
            get_static_url(type, is_plugins) {
                // 榛樿鍏叡鍦板潃
                if ((type || null) == null) {
                    type = 'common';
                }
                // 鏄惁鎻掍欢
                if ((is_plugins || false) == true) {
                    // 鏍规嵁閰嶇疆鐨勯潤鎬乽rl鍦板潃+鎻掍欢鏍囪瘑绗?
                    return this.data.static_url + 'static/plugins/' + type + '/images/';
                } else {
                    // 鏍规嵁閰嶇疆鐨勯潤鎬乽rl鍦板潃+涓婚鏍囪瘑+鍙傛暟绫诲瀷缁勫悎杩滅▼闈欐€佹枃浠跺湴鍧€
                    return this.data.static_url + 'static/app/' + this.get_theme_value() + '/' + type + '/';
                }
            },

            // rpx杞琾x
            rpx_to_px(value) {
                return (value || 0) == 0 ? 0 : uni.upx2px(value * 2);
            },

            // px杞瑀px
            px_to_rpx(value) {
                const new_value = value * 2 || 0;
                // 200 涓?100px 鐨勫€硷紝鍚庨潰鐨勪袱涓?100 涓鸿绠楁瘮渚嬩娇鐢?
                var rpx = new_value / (uni.upx2px(value) / value);
                // 楠岃瘉涓婇潰rpx鐨勫€?
                return uni.upx2px(rpx);
            },

            // 鏄惁pc
            is_pc() {
                var arr = ['macos', 'windows'];
                return arr.indexOf(uni.getSystemInfoSync().platform) != -1;
            },

            // 缁堢绫诲瀷
            application_client() {
                var type = '';
                // #ifdef APP
                type = 'app';
                // #endif
                // #ifdef H5
                type = 'h5';
                // #endif
                // #ifdef MP
                type = 'mp';
                // #endif
                return type;
            },

            // 缁堢绫诲瀷鍊?
            application_client_type() {
                var value = '';
                // #ifdef MP-WEIXIN
                value = 'weixin';
                // #endif
                // #ifdef MP-ALIPAY
                value = 'alipay';
                // #endif
                // #ifdef MP-BAIDU
                value = 'baidu';
                // #endif
                // #ifdef MP-QQ
                value = 'qq';
                // #endif
                // #ifdef MP-TOUTIAO
                value = 'toutiao';
                // #endif
                // #ifdef MP-KUAISHOU
                value = 'kuaishou';
                // #endif
                // #ifdef H5
                value = 'h5';
                // #endif
                // #ifdef APP
                value = this.get_system_info('platform', null, true);
                // #endif
                return value;
            },

            // app瀹㈡埛绔搧鐗?
            application_client_brand() {
                var value = this.get_system_info('brand', null, true);
                return (value === null) ? '' : value.toLowerCase();
            },

            // 鎺堟潈楠岃瘉
            auth_check(object, method, scope, msg) {
                var self = this;
                uni.getSetting({
                    success(res) {
                        if (!res.authSetting[scope]) {
                            uni.authorize({
                                scope: scope,
                                success(res) {
                                    if (typeof object === 'object' && (method || null) != null) {
                                        object[method](1);
                                    }
                                },
                                fail(res) {
                                    self.showToast(msg || i18n.t('shopxo-uniapp.app.gbiac6'));
                                    setTimeout(function () {
                                        uni.openSetting();
                                    }, 1000);
                                },
                            });
                        } else {
                            if (typeof object === 'object' && (method || null) != null) {
                                object[method](1);
                            }
                        }
                    },
                });
            },

            // 绐楀彛瀹藉害澶勭悊
            window_width_handle(width) {
                // #ifdef H5 || APP
                if (width > 960) {
                    width = 800;
                }
                // #endif
                return width;
            },

            // 绐楀彛楂樺害澶勭悊
            window_height_handle(system) {
                var height = system.windowHeight;
                // 鐘舵€佹爮
                if (system.statusBarHeight > 0) {
                    height += system.statusBarHeight;
                }
                // 瀵艰埅鏍?
                if (system.windowTop > 0) {
                    height += system.windowTop;
                }
                // 搴曢儴鑿滃崟
                if (system.windowBottom > 0) {
                    height += system.windowBottom;
                }
                return height;
            },

            // 鑾峰彇褰撳墠椤甸潰鍦板潃
            // is_whole 瀹屾暣鍦板潃锛?鍚庨潰鐨勫弬鏁帮級
            get_page_url(is_whole = true) {
                var url = this.current_page();
                // #ifdef APP
                url = this.page_url_protocol(url);
                // #endif
                // #ifdef H5
                url = window.location.href;
                // #endif
                if (is_whole == false) {
                    var temp = url.split('?');
                    url = temp[0];
                }
                return url;
            },

            // url鍗忚鍦板潃澶勭悊
            page_url_protocol(url) {
                if ((url || null) != null && !this.is_url(url)) {
                    // 鎷兼帴H5鍦板潃
                    var host = this.get_config('config.common_app_h5_url', '');
                    // #ifdef H5
                    if(host == '') {
                        // H5妯″紡涓嬨€佹湭鎸囧畾H5鍦板潃鍒欒幏鍙栧綋鍓峢ost
                        host = window.location.href.split('#')[0]+'#/';
                    }
                    // #endif
                    // 澶勭悊涓棿鎷兼帴鐨勬枩鏉犳槸鍚﹂噸澶?
                    url = (host + url).replace('#//', '#/');
                }
                return url;
            },

            // 鏄惁寰俊鐜
            is_weixin_env() {
                var agent = navigator.userAgent.toLowerCase();
                if (agent.match(/MicroMessenger/i) == 'micromessenger') {
                    return true;
                }
                return false;
            },

            // 鐢ㄦ埛寰俊webopenid鏄惁瀛樺湪
            is_user_weixin_web_openid(order_ids, payment_id = 0, page = null) {
                // 寰俊鐜鍒ゆ柇鏄惁宸叉湁web_openid銆佷笉瀛樺湪鍒欒烦杞埌鎻掍欢杩涜鎺堟潈
                if (this.is_weixin_env()) {
                    var web_openid = this.get_user_cache_info('weixin_web_openid') || null;
                    if (web_openid == null) {
                        // 宸茬粡鎺堟潈鍒欓噸鏂板埛鏂扮敤鎴蜂俊鎭?
                        var params = this.get_launch_cache_info();
                        if (params != null && (params.is_weixin_auth_web_openid || 0) == 1) {
                            uni.showLoading({
                                title: i18n.t('common.processing_in_text'),
                            });
                            uni.request({
                                url: this.get_request_url('tokenuserinfo', 'user'),
                                method: 'POST',
                                data: {},
                                dataType: 'json',
                                success: (res) => {
                                    uni.hideLoading();
                                    if (res.data.code == 0) {
                                        uni.setStorageSync(this.data.cache_user_info_key, res.data.data);
                                    } else {
                                        this.showToast(res.data.msg);
                                    }
                                },
                                fail: () => {
                                    uni.hideLoading();
                                    this.showToast(i18n.t('common.internet_error_tips'));
                                },
                            });
                            return true;
                        } else {
                            uni.setStorageSync(this.data.cache_page_pay_key, {
                                order_ids: typeof order_ids == 'array' ? order_ids.join(',') : order_ids,
                                payment_id: payment_id,
                            });
                            var page_url = (page || null) == null ? this.get_page_url() : this.page_url_protocol(page);
                            page_url += page_url.indexOf('?') == -1 ? '?' : '&';
                            page_url += 'is_weixin_auth_web_openid=1';
                            var request_url = encodeURIComponent(base64.encode(page_url));
                            var url = this.get_request_url('index', 'pay', 'weixinwebauthorization', 'request_url=' + request_url, 'index').replace('&ajax=ajax', '');
                            window.location.href = url;
                        }
                        return false;
                    }
                }
                return true;
            },

            // app鏍囬
            get_application_title() {
                var value = null;
                // 鏍规嵁缁堢绫诲瀷鑾峰彇瀵瑰簲鏁版嵁
                var type = this.application_client_type() || null;
                if (type !== null) {
                    value = this.get_config('config.common_app_mini_' + type + '_title') || null;
                }
                // 鑾峰彇鍏叡鏁版嵁
                if (value === null) {
                    value = this.get_config('config.home_site_name', this.data.application_title);
                }
                return value;
            },

            // app鎻忚堪
            get_application_describe() {
                var value = null;
                // 鏍规嵁缁堢绫诲瀷鑾峰彇瀵瑰簲鏁版嵁
                var type = this.application_client_type() || null;
                if (type !== null) {
                    value = this.get_config('config.common_app_mini_' + type + '_describe') || null;
                }
                // 鍟嗗簵浠嬬粛
                if (type !== null) {
                    value = this.get_config('config.common_customer_store_describe') || null;
                }
                // 鑾峰彇鍏叡鏁版嵁
                if (value === null) {
                    value = this.data.application_describe;
                }
                return value;
            },

            // applogo
            get_application_logo() {
                var logo = this.data.application_logo || null;
                if (logo == null) {
                    logo = this.get_config('config.home_site_logo_app') || this.get_config('config.home_site_logo_wap');
                }
                return logo;
            },

            // 姝ｆ柟褰ogo
            get_application_logo_square() {
                return this.get_config('config.home_site_logo_square');
            },

            // 鍒嗕韩鍐呭澶勭悊
            share_content_handle(data) {
                // 鑾峰彇鎻掍欢閰嶇疆淇℃伅
                var share_config = this.get_config('plugins_base.share.data') || {};
                var result = {
                    title: data.title || share_config.title || this.get_application_title(),
                    desc: data.desc || share_config.desc || this.get_application_describe(),
                    path: data.path || this.app_tabbar_pages()[0],
                    query: this.share_query_handle(data.query || ''),
                    img: data.img || share_config.pic || this.get_application_logo_square(),
                };
                result['url'] = this.get_page_url();
                // #ifdef H5 || APP
                // 鏄湁鏁堢殑url鍦板潃鍒欓€氳繃#鍙峰垎鍓插鐞嗗弬鏁?
                if(this.is_url(result['url'])) {
                    result['url'] = this.page_url_protocol(result.url.split('#')[0] + '#' + ((result.path || null) != null && result.path.substr(0, 1) == '/' ? '' : '/') + (result.path || '') + (result.query || ''));
                }
                // #endif
                return result;
            },

            // 鍒嗕韩鍙傛暟澶勭悊
            share_query_handle(query) {
                if ((query || null) == null || query.indexOf('invite_code') == -1) {
                    var invite_code = this.get_user_cache_info('invite_code', '') || '';
                    if (invite_code !== '') {
                        var join = (query || null) == null ? '' : '&';
                        query += join + 'invite_code=' + invite_code;
                    }
                }
                if ((query || null) == null || query.indexOf('referrer') == -1) {
                    var user_id = parseInt(this.get_user_cache_info('id', 0)) || 0;
                    if (user_id > 0) {
                        var join = (query || null) == null ? '' : '&';
                        query += join + 'referrer=' + user_id;
                    }
                }
                return (query || null) == null ? '' : '?' + query;
            },

            get_user_invite_code_by_id(user_id) {
                if (!user_id) return '';
                var info = uni.getStorageSync(this.data.cache_user_info_key) || null;
                if (info && info.id == user_id && info.invite_code) {
                    return info.invite_code;
                }
                return '';
            },

            // 鏄惁鏈嬪弸鍦堝崟椤佃闂彁绀?
            is_single_page_check() {
                if (this.is_current_single_page() == 1) {
                    this.showToast(i18n.t('shopxo-uniapp.app.3eqv71'));
                    return false;
                }
                return true;
            },

            // 璋冪敤椤甸潰鏂规硶
            get_page_object(page = null) {
                var pages = getCurrentPages();
                if(page == null) {
                    return pages[pages.length - 1];
                } else {
                    var result = [];
                    for (var i = 0; i < pages.length; i++) {
                        if (pages[i]['route'] == page) {
                            result.push(pages[i]);
                        }
                    }
                    return result;
                }
            },

            // 褰撳墠椤甸潰鍦板潃
            // is_whole 瀹屾暣鍦板潃锛?鍚庨潰鐨勫弬鏁帮級
            current_page(is_whole = true) {
                // 鏉ユ簮鍦板潃銆佹嫾鎺ュ綋鍓嶅皬绋嬪簭椤甸潰
                var pages = getCurrentPages();
                var page = pages[pages.length - 1];
                var url = this.page_url_handle(page);
                if (is_whole == false) {
                    var temp = url.split('?');
                    url = temp[0];
                }
                return url;
            },

            // 涓婁竴椤甸〉闈㈠湴鍧€
            prev_page() {
                var value = null;
                var pages = getCurrentPages();
                var length = pages.length;
                if (length > 1) {
                    value = this.page_url_handle(pages[length - 2]);
                }
                return value;
            },

            // 杩斿洖涓婁竴椤点€佸垯鍥炲埌shouy锛屾病鏈夐〉闈㈢殑鏃跺€檜rl鏄惁鎸囧畾椤甸潰
            page_back_prev_event(url = null) {
                var prev_page = this.prev_page();
                if (prev_page == null) {
                    this.url_open(url || this.app_tabbar_pages()[0]);
                } else {
                    uni.navigateBack();
                }
            },

            // 椤甸潰鍦板潃澶勭悊
            page_url_handle(page) {
                if ((page || null) == null) {
                    return '';
                }

                // 鐩存帴鑾峰彇椤甸潰鍏ㄧ殑璺緞鍦板潃
                if((page.$page || null) != null && (page.$page.fullPath || null) != null) {
                    var path = page.$page.fullPath;
                    return path.substr(0, 1) == '/' ? path.substr(1) : path;
                }

                // 鎷兼帴鍦板潃鍜屽弬鏁?
                var route = page.route;
                var options = page.options || {};
                var query = '';
                if (JSON.stringify(options) != '{}') {
                    for (var i in options) {
                        query += '&' + i + '=' + options[i];
                    }
                }
                if ((query || null) != null) {
                    route += '?' + query.substr(1);
                }
                return route;
            },

            // 杩涘叆瀹㈡湇
            chat_entry_handle(url) {
                if ((url || null) == null) {
                    this.showToast(i18n.t('shopxo-uniapp.app.08cg8y'));
                } else {
                    // 鎷兼帴鍩虹鍙傛暟
                    url = this.request_params_handle(url);
                    // 鎷兼帴褰撳墠椤甸潰鍦板潃
                    var route = this.current_page();
                    url += '&source=' + encodeURIComponent(base64.encode(route).replace(new RegExp(/=/g), ''));
                    // 鎵撳紑webview
                    this.open_web_view(url);
                }
            },

            // 鐢ㄦ埛鑷姩鐧诲綍澶勭悊
            user_auto_login_handle() {
                // #ifdef H5
                var user = this.get_user_cache_info();
                if (user == null) {
                    var params = this.get_launch_cache_info() || {};
                    var config = this.get_config('plugins_base.thirdpartylogin.data') || null;
                    var data = this.get_config('plugins_thirdpartylogin_data') || null;
                    var url = null;
                    // 鏄惁寰俊鐜
                    if ((params.thirdpartylogin || null) == null && config != null && data != null && this.is_weixin_env()) {
                        var is_auto = config.weixin_is_env_auto_login || 0;
                        var weixin = data.weixin || null;
                        if (is_auto != 0 && weixin != null) {
                            url = weixin.login_url;
                        }
                    }
                    // 瀛樺湪鐧诲綍url鍒欒烦杞櫥褰?
                    if (url != null) {
                        // 涓婁竴涓〉闈㈣褰?
                        var page = this.current_page();
                        if (page != null) {
                            uni.setStorageSync(this.data.cache_prev_page_key, page);
                        }
                        // 璺宠浆鐧诲綍
                        window.location.href = url;
                    }
                }
                // #endif
            },

            // 娓呴櫎鐢ㄦ埛缂撳瓨
            remove_user_cache_event(is_remove_user = true) {
                // 褰撳墠骞冲彴
                var client_value = this.application_client();
                // 鏄惁娓呴櫎鐢ㄦ埛鐧诲綍淇℃伅
                if(is_remove_user) {
                    // 鐢ㄦ埛鐧诲綍缂撳瓨
                    uni.removeStorageSync(this.data.cache_user_login_key);
                    // 鐢ㄦ埛淇℃伅缂撳瓨
                    uni.removeStorageSync(this.data.cache_user_info_key);
                }
                // 鏈櫥褰曟彁绀虹紦瀛樿褰?
                uni.removeStorageSync(this.data.cache_user_no_login_page_status_data_key);
                // 鐢ㄦ埛鍩虹璧勬枡鎻愮ず闂撮殧key
                uni.removeStorageSync(this.data.cache_user_base_personal_interval_time_key);
                // app鏇存柊鎻愮ず缂撳瓨璁板綍key
                uni.removeStorageSync(this.data.cache_app_update_tips_interval_time_key);
                // app璇勫垎鎻愮ず缂撳瓨璁板綍key
                uni.removeStorageSync(this.data.cache_app_star_tips_interval_time_key);

                // 闈炲皬绋嬪簭鍒欎袱绉掑悗鍥炲埌棣栭〉
                this.showToast(i18n.t('shopxo-uniapp.app.'+((client_value == 'mp' || !is_remove_user) ? '0gwt7z' : '87yghj')), 'success');
            },

            // 鏄惁绔欑偣鍙樼伆
            is_app_mourning() {
                var is_app = parseInt(this.get_config('plugins_base.mourning.data.is_app', 0));
                if (is_app == 1) {
                    // 褰撳墠鏃堕棿鎴?
                    var time_current = Date.parse(new Date());
                    // 寮€濮嬫椂闂?
                    var time_start = this.get_config('plugins_base.mourning.data.time_start') || null;
                    if (time_start != null) {
                        if (Date.parse(new Date(time_start)) > time_current) {
                            return false;
                        }
                    }
                    // 缁撴潫鏃堕棿
                    var time_end = this.get_config('plugins_base.mourning.data.time_end') || null;
                    if (time_end != null) {
                        if (Date.parse(new Date(time_end)) < time_current) {
                            return false;
                        }
                    }
                    return true;
                }
                return false;
            },

            // 浠锋牸绗﹀彿
            currency_symbol() {
                return this.get_config('currency_symbol') || this.data.currency_symbol;
            },

            // 璐墿杞︾粨绠楁暟鎹弬鏁?
            // appoint_goods_ids  鎸囧畾缁撶畻鍟嗗搧id锛屽涓猧d閫楀彿鍒嗗壊锛?
            buy_cart_data_params(data, appoint_goods_ids = null) {
                // 瑙ｆ瀽褰撳墠閫夋嫨鐨勬暟鎹晢鍝乮d
                var temp_appoint_goods_ids = [];
                if((appoint_goods_ids || null) != null) {
                    temp_appoint_goods_ids = appoint_goods_ids.split(',').map(function(v){return parseInt(v);});
                }
                // 鍖归厤鍟嗗搧
                var ids = [];
                if ((data || null) != null) {
                    for (var i in data) {
                        if (data[i]['is_error'] == 0 && (temp_appoint_goods_ids.length == 0 || temp_appoint_goods_ids.indexOf(parseInt(data[i]['goods_id'])) != -1)) {
                            ids.push(data[i]['id']);
                        }
                    }
                }
                if(ids.length <= 0) {
                    return false;
                }
            
                // 缁撶畻鍙傛暟
                return {
                    buy_type: 'cart',
                    ids: ids.join(','),
                };
            },

            // 杩涘叆璐拱
            to_buy_handle(buy_data, pages = '/pages/buy/buy') {
                this.url_open(pages+'?data=' + encodeURIComponent(base64.encode(JSON.stringify(buy_data))));
            },

            // 浣嶇疆鏉冮檺鏍￠獙
            get_location_check(type, object, method) {
                // #ifdef MP-WEIXIN || MP-BAIDU || MP-TOUTIAO || MP-QQ
                var self = this;
                uni.getSetting({
                    success(res) {
                        if (!res.authSetting[type]) {
                            uni.authorize({
                                scope: type,
                                success(res) {
                                    if (typeof object === 'object' && (method || null) != null) {
                                        object[method](1);
                                    }
                                },
                                fail: (res) => {
                                    if (typeof object === 'object' && (method || null) != null) {
                                        object[method](0);
                                    }
                                },
                            });
                        } else {
                            if (typeof object === 'object' && (method || null) != null) {
                                object[method](1);
                            }
                        }
                    },
                    fail: (res) => {
                        self.showToast(i18n.t('shopxo-uniapp.app.di6v5t'));
                        if (typeof object === 'object' && (method || null) != null) {
                            object[method](0);
                        }
                    },
                });
                // #endif
                // #ifdef MP-ALIPAY || H5 || APP
                if (typeof object === 'object' && (method || null) != null) {
                    object[method](1);
                }
                // #endif
                // #ifdef MP-KUAISHOU
                self.showToast(i18n.t('shopxo-uniapp.app.nu5058'));
                if (typeof object === 'object' && (method || null) != null) {
                    object[method](0);
                }
                // #endif
            },

            // 鍚姩浣嶇疆鐩戝惉锛? 鎵撳紑浣嶇疆瀹炴椂鐩戝惉銆?灏忕▼搴忓悗鍙拌繍琛屼篃鐩戝惉锛堜粎寰俊銆佸揩鎵嬶級灏忕▼搴忔敮鎸侊級
            start_location_update(type = 0, object, method) {
                // 闈炲井淇″拰蹇墜灏忕▼搴弔ype=1鍒欒祴鍊间负0
                // #ifndef MP-WEIXIN || MP-KUAISHOU
                if (type == 1) {
                    type = 0;
                }
                // #endif

                // 濡傛灉椤甸潰宸插瓨鍦ㄤ綅缃皟鐢ㄥ垯涓嶉噸澶嶈皟鐢?
                var page = this.current_page(false);
                var temp_location = this.data.location_update_page_temp_record_data;
                if (temp_location.indexOf(page) == -1) {
                    // 鏍规嵁绫诲瀷璋冪敤api
                    if (type == 1) {
                        // 寮€濮嬬洃鍚疄鏃跺湴鐞嗕綅缃俊鎭彉鍖栦簨浠讹紝灏忕▼搴忚繘鍏ュ墠鍚庡彴鏃跺潎鎺ユ敹瀹炴椂鍦扮悊浣嶇疆淇℃伅
                        // 杩欎釜鏂规硶浠呭井淇″拰蹇墜灏忕▼搴忔敮鎸?
                        // #ifdef MP-WEIXIN || MP-KUAISHOU
                        uni.startLocationUpdateBackground({
                            success: (res) => {
                                // 澧炲姞椤甸潰璁板綍
                                temp_location.push(page);
                                this.data.location_update_page_temp_record_data = temp_location;

                                // 璋冪敤浣嶇疆鐩戝惉鏂规硶
                                this.start_location_update_change(object, method);
                            },
                            fail: (res) => {
                                if (typeof object === 'object' && (method || null) != null) {
                                    object[method]({
                                        status: 0,
                                        msg: res.errMsg,
                                    });
                                }
                            },
                        });
                        // #endif
                    } else {
                        // 鎵撳紑浣嶇疆鐩戝惉
                        uni.startLocationUpdate({
                            success: (res) => {
                                // 澧炲姞椤甸潰璁板綍
                                temp_location.push(page);
                                this.data.location_update_page_temp_record_data = temp_location;

                                // 璋冪敤浣嶇疆鐩戝惉鏂规硶
                                this.start_location_update_change(object, method);
                            },
                            fail: (res) => {
                                if (typeof object === 'object' && (method || null) != null) {
                                    object[method]({
                                        status: 0,
                                        msg: res.errMsg,
                                    });
                                }
                            },
                        });
                    }
                }
            },

            // 浣嶇疆鐩戝惉鏀瑰彉
            start_location_update_change(object, method) {
                uni.onLocationChange((res) => {
                    if (typeof object === 'object' && (method || null) != null) {
                        object[method]({
                            status: 1,
                            lng: res.longitude,
                            lat: res.latitude,
                            data: res,
                        });
                    }
                });
            },

            // 缃戠粶鐘舵€佹鏌ュ鐞?
            network_type_handle(object, method, params = {}) {
                // 濡傛灉椤甸潰宸插瓨鍦ㄤ綅缃皟鐢ㄥ垯涓嶉噸澶嶈皟鐢?
                var page = this.current_page(false);
                var temp_network = this.data.network_type_page_record_timer || {};
                var temp = temp_network[page] || null;
                if (temp == null) {
                    var self = this;
                    temp_network[page] = {
                        object: object,
                        method: method,
                        params: params,
                    };
                    temp_network[page]['timer'] = setInterval(function () {
                        uni.getNetworkType({
                            success: function (res) {
                                if (res.networkType != 'none' && (temp_network[page] || null) != null) {
                                    // 宸插垵濮嬪寲鍒欐竻闄ゅ畾鏃朵换鍔?
                                    if ((temp_network[page]['timer'] || null) != null) {
                                        clearInterval(temp_network[page]['timer']);
                                    }
                                    var pv = temp_network[page];
                                    delete temp_network[page];
                                    self.data.network_type_page_record_timer = temp_network;
                                    // 鍥炶皟椤甸潰
                                    if (typeof pv.object === 'object' && (pv.method || null) != null) {
                                        pv.object[pv.method]({ ...(pv.params || {}), ...{ loading: 1 } });
                                    }
                                }
                            },
                        });
                    }, 500);
                    this.data.network_type_page_record_timer = temp_network;
                }
            },

            // 鑾峰彇涓婚鑹插€?
            // is_light 鏄惁鑾峰彇娴呬富鑹诧紙false, true锛?
            get_theme_color(theme, is_light = false) {
                let color_obj = {
                    // 涓昏壊
                    red: '#ff0036', // 绾㈣壊
                    yellow: '#f6c133', // 榛勮壊
                    black: '#333333', // 榛戣壊
                    blue: '#1677ff', // 钃濊壊
                    green: '#20a53a', // 缁胯壊
                    orange: '#fe6f04', // 姗欒壊
                    brown: '#8B4513', // 妫曡壊
                    purple: '#623cec', // 绱壊

                    // 娴呬富鑹?
                    red_light: '#ffdbe2', // 绾㈣壊
                    yellow_light: '#ffebd2', // 榛勮壊
                    black_light: '#dcdcdc', // 榛戣壊
                    blue_light: '#d1e4ff', // 钃濊壊
                    green_light: '#cce8d2', // 缁胯壊
                    orange_light: '#fde4d1', // 姗欒壊
                    brown_light: '#eadcd2', // 妫曡壊
                    purple_light: '#d6cbfb', // 绱壊
                };
                // 褰撳墠涓婚
                if ((theme || null) == null) {
                    theme = this.get_theme_value();
                }
                if (is_light) {
                    theme += '_light';
                }
                return color_obj[theme];
            },

            // 鑾峰彇涓婚椤甸潰鏍囪瘑
            get_theme_value_view() {
                return 'theme-' + this.get_theme_value();
            },

            // 鑾峰彇涓婚
            get_theme_value() {
                // 涓婚绫诲瀷        涓婚棰滆壊
                // 绾㈣壊 red       #ff0036
                // 榛勮壊 yellow    #f6c133
                // 榛戣壊 black     #333333
                // 缁胯壊 green     #20a53a
                // 姗欒壊 orange    #fe6f04
                // 钃濊壊 blue      #1677ff
                // 妫曡壊 brown     #8B4513
                // 绱壊 purple    #623cec
                return uni.getStorageSync('theme') || this.data.default_theme;
            },

            // 鍒囨崲涓婚
            set_theme_value(value) {
                // 璁剧疆涓婚缂撳瓨
                uni.setStorageSync('theme', value || this.data.default_theme);
            },

            // 搴曢儴鑿滃崟璁剧疆
            set_tabbar(theme) {
                // 褰撳墠涓婚
                if ((theme || null) == null) {
                    theme = this.get_theme_value();
                }
            
                // 鏁翠綋鏍峰紡
                uni.setTabBarStyle({
                    selectedColor: this.get_theme_color(theme),
                    color: '#333333',
                    backgroundColor: '#ffffff',
                    borderStyle: 'black'
                });

                // 鑿滃崟
                var temp_system_tabbar = this.data.system_tabbar;
                if(temp_system_tabbar.length > 0) {
                    // 棣栭〉
                    uni.setTabBarItem({
                        index: 0,
                        iconPath: 'static/images/common/tabbar/home.png',
                        selectedIconPath: 'static/images/' + theme + '/tabbar/home.png',
                        text: i18n.t('common.home'),
                    });
                }
                // 鍚庨潰涓変釜鑿滃崟瀛樺湪鍒欒缃?
                for(var i in temp_system_tabbar) {
                    switch(temp_system_tabbar[i]) {
                        case '/pages/goods-category/goods-category' :
                            uni.setTabBarItem({
                                index: parseInt(i),
                                iconPath: 'static/images/common/tabbar/category.png',
                                selectedIconPath: 'static/images/' + theme + '/tabbar/category.png',
                                text: i18n.t('common.category'),
                            });
                            break;
                        case '/pages/activity/activity' :
                            uni.setTabBarItem({
                                index: parseInt(i),
                                iconPath: 'static/images/common/tabbar/activity.png',
                                selectedIconPath: 'static/images/' + theme + '/tabbar/activity.png',
                                text: i18n.t('common.activity'),
                            });
                            break;
                        case '/pages/cart/cart' :
                            uni.setTabBarItem({
                                index: parseInt(i),
                                iconPath: 'static/images/common/tabbar/cart.png',
                                selectedIconPath: 'static/images/' + theme + '/tabbar/cart.png',
                                text: i18n.t('common.cart'),
                            });
                            break;
                        case '/pages/user/user' :
                            uni.setTabBarItem({
                                index: parseInt(i),
                                iconPath: 'static/images/common/tabbar/user.png',
                                selectedIconPath: 'static/images/' + theme + '/tabbar/user.png',
                                text: i18n.t('common.my'),
                            });
                            break;
                    }
                }
            },

            // 鏁扮粍鍒嗙粍
            group_arry(arry, sub_group_length) {
                let index = 0;
                let new_arry = [];
                if (arry.length > sub_group_length) {
                    while (index < arry.length) {
                        new_arry.push(arry.slice(index, (index += sub_group_length)));
                    }
                } else {
                    new_arry = [arry];
                }
                return new_arry;
            },

            // 棰滆壊杞瑀gba hexValue锛?鑹插€? alpha锛氶€忔槑搴?
            hex_rgba(hexValue, alpha) {
                const rgx = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
                const hex = hexValue.replace(rgx, (m, r, g, b) => r + r + g + g + b + b);
                const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                if (!rgb) {
                    return hexValue;
                }
                const r = parseInt(rgb[1], 16),
                    g = parseInt(rgb[2], 16),
                    b = parseInt(rgb[3], 16);
                return `rgba(${r},${g},${b},${alpha})`;
            },

            // 鍒ゆ柇鏁扮粍鍐呮槸鍚﹀惈鏈夌浉鍚屽瓧娈?
            some_arry(arr, val, params) {
                return arr.some(function (arrVal) {
                    if (params) {
                        return val === arrVal[params];
                    } else {
                        return val === arrVal;
                    }
                });
            },

            // 鏇存柊褰撳墠url鍙傛暟
            // query:[{key:'',value:''}]
            update_query_string_parameter(query = []) {
                // #ifdef H5
                let url = window.location.href;
                // 鍒ゆ柇娌℃湁鍙傛暟鏃?
                if (query.length < 1) {
                    //鍚戝綋鍓島rl娣诲姞鍙傛暟锛屾病鏈夊巻鍙茶褰?
                    window.history.replaceState({ path: url.split('?')[0] }, '', url.split('?')[0]);
                } else {
                    query.forEach((item) => {
                        let re = new RegExp('([?&])' + item.key + '=.*?(&|$)', 'i');
                        let separator = url.indexOf('?') !== -1 ? '&' : '?';
                        if (url.match(re)) {
                            url = url.replace(re, '$1' + item.key + '=' + item.value + '$2');
                        } else {
                            url += separator + item.key + '=' + item.value;
                        }
                    });
                    //鍚戝綋鍓島rl娣诲姞鍙傛暟锛屾病鏈夊巻鍙茶褰?
                    window.history.replaceState({ path: url }, '', url);
                }
                // #endif
            },

            // 璁＄畻鏂囨湰瀹藉害
            string_width(value, max = null) {
                var width = 0;
                var reg = /^[A-Za-z0-0]+$/;
                var arr = value.split('');
                for (var i in arr) {
                    width += reg.test(arr[i]) ? 34 : 50;
                }
                return max !== null && width > max ? max : width;
            },

            // weburl鍦板潃id鍊煎尮閰?
            web_url_value_mate(url, rules) {
                // 鍖归厤鎴愬姛
                var status = 0;
                // 瀛樺湪鏁版嵁鍊?
                var value = null;
                for (var i in rules) {
                    if (url.indexOf(rules[i]) != -1) {
                        var temp = url.split(rules[i]);
                        if (temp.length > 1) {
                            temp = temp[1].split('.');
                            if (temp.length > 0 && (temp[0] || null) != null) {
                                value = temp[0];
                            }
                        }
                        status = 1;
                        break;
                    }
                }
                return { status: status, value: value };
            },

            // 鎵撳紑鏉冮檺绠＄悊涓績
            open_setting_event() {
                // #ifdef MP
                uni.openSetting();
                // #endif
                // #ifdef APP
                uni.openAppAuthorizeSetting();
                // #endif
            },

            // 鎵爜瑙ｆ瀽澶勭悊
            scan_handle() {
                // #ifdef H5
                this.showToast(i18n.t('common.not_supported_scan_tips'));
                // #endif
                // #ifndef H5
                var self = this;
                uni.scanCode({
                    success: function (res) {
                        if (res.result !== '') {
                            var value = res.result;
                            // 鏄惁涓簎rl鍦板潃
                            if (self.is_url(value)) {
                                // 鏄惁涓哄晢鍝佸湴鍧€
                                var goods_arr = ['/goods-', '/goods/index/id/', '=goods/index/id/'];
                                var goods_ret = self.web_url_value_mate(value, goods_arr);
                                if (goods_ret.status == 1 && goods_ret.value != null) {
                                    uni.navigateTo({
                                        url: '/pages/goods-detail/goods-detail?id=' + goods_ret.value,
                                    });
                                    return;
                                }

                                // 鏄惁涓哄鍟嗘埛搴楅摵璇︽儏鍦板潃
                                var shop_arr = ['/shop-index-detail-', '/plugins/index/pluginsname/shop/pluginscontrol/index/pluginsaction/detail/id/', '=plugins/index/pluginsname/shop/pluginscontrol/index/pluginsaction/detail/id/'];
                                var shop_ret = self.web_url_value_mate(value, shop_arr);
                                if (shop_ret.status == 1 && shop_ret.value != null) {
                                    self.url_open('/pages/plugins/shop/detail/detail?id=' + shop_ret.value);
                                    return;
                                }

                                // 鏄惁涓烘壂鐮佹敹娆?
                                var scanpay_arr = ['/scanpay-index-index', 'plugins/index/pluginsname/scanpay/pluginscontrol/index/pluginsaction/index', 'plugins/index/pluginsname/scanpay', '/scanpay'];
                                var scanpay_ret = self.web_url_value_mate(value, scanpay_arr);
                                if (scanpay_ret.status == 1) {
                                    var url = '/pages/plugins/scanpay/index/index';
                                    if (scanpay_ret.value != null) {
                                        var first = scanpay_ret.value.substr(0, 1);
                                        if (first == '-') {
                                            var temp = scanpay_ret.value.substr(1).split('/');
                                            if (temp.length == 3) {
                                                url += '?id=' + temp[0] + '&type=' + temp[2];
                                            }
                                        } else if (first == '/') {
                                            var temp = scanpay_ret.value.substr(1).split('/');
                                            if (temp.length == 4) {
                                                url += '?id=' + temp[1] + '&type=' + temp[3];
                                            }
                                        }
                                    }
                                    uni.navigateTo({
                                        url: url,
                                    });
                                    return;
                                }

                                // 鏄惁涓烘壂鐮佺櫥褰?
                                var thirdpartylogin_arr = ['/thirdpartylogin-scan-index-', 'plugins/index/pluginsname/thirdpartylogin/pluginscontrol/scan/pluginsaction/index/id/'];
                                var thirdpartylogin_ret = self.web_url_value_mate(value, thirdpartylogin_arr);
                                if (thirdpartylogin_ret.status == 1 && thirdpartylogin_ret.value != null) {
                                    uni.navigateTo({
                                        url: '/pages/plugins/thirdpartylogin/index/index?id=' + thirdpartylogin_ret.value,
                                    });
                                    return;
                                }

                                // 榛樿鎵撳紑url
                                self.open_web_view(value);
                            } else {
                                self.url_open(value);
                            }
                        }
                    },
                });
                // #endif
            },

            // 鑾峰彇褰撳墠璇█
            get_language_value() {
                // 褰撳墠绯荤粺璇█銆侀粯璁や腑鏂?
                let value = uni.getLocale() || this.data.default_language;
                // 璇█鏍囪瘑杞崲鍜屽悗绔竴鑷?
                let arr = {
                    'zh-Hans': 'zh',
                    'zh-Hant': 'cht',
                    'en-US': 'en',
                    'es': 'spa',
                    'fra': 'fr',
                };
                return ((arr[value] || null) == null) ? value : arr[value];
            },

            // 閫夋嫨鐢ㄦ埛鍦扮悊浣嶇疆
            choose_user_location_event() {
                // 瀛樺湪鏁版嵁鍒欐敼鍙樼姸鎬佸€?
                var key = this.data.cache_userlocation_key;
                var result = uni.getStorageSync(key) || null;
                if(result != null) {
                    result['status'] = 2;
                    uni.setStorageSync(key, result);
                }

                // 杩涘叆椤甸潰閫夋嫨浣嶇疆
                uni.navigateTo({
                    url: '/pages/common/open-setting-location/open-setting-location',
                });
            },

            // 娓呴櫎浣嶇疆缂撳瓨淇℃伅
            choice_user_location_remove() {
                uni.removeStorageSync(this.data.cache_userlocation_key);
            },

            // 鍦板潃淇℃伅鍒濆鍖?
            choice_user_location_init() {
                // status 0鏈€夋嫨锛?宸查€夋嫨锛?閫夋嫨涓紝3閫夋嫨澶辫触
                var result = uni.getStorageSync(this.data.cache_userlocation_key) || null;
                var user_location = { status: 0 };
                if (result != null) {
                    user_location = {
                        ...user_location,
                        ...{
                            name: result.name || null,
                            address: result.address || null,
                            lat: result.lat || null,
                            lng: result.lng || null,
                            status: result.status || 1,
                        },
                    };
                }
                // 榛樿鍚嶇О
                var default_name = i18n.t('shopxo-uniapp.app.4v6q86');
                // 浣嶇疆閫夋嫨澶辫触鐨勭姸鎬侊紝鍚嶇О鍜岄粯璁ゅ悕绉颁笉涓€鑷村垯璁や负鏄垚鍔熺殑
                if(user_location.status == 3 && user_location.name != default_name) {
                    user_location.status = 1;
                }
                user_location['text'] = user_location.name || user_location.address || default_name;
                return user_location;
            },

            // 鑾峰彇鐢ㄦ埛褰撳墠浣嶇疆
            // object    鍥炶皟瀵硅薄
            // method    鍥炶皟鏂规硶
            // is_force  寮哄埗鑾峰彇浣嶇疆
            get_user_location(object = null, method = null, is_force = false) {
                if(this.data.get_user_location_status == 1 || is_force) {
                    var cache_key = this.data.cache_userlocation_key;
                    var result = uni.getStorageSync(cache_key) || null;
                    if(result == null) {
                        // 褰撳墠瀵硅薄
                        var self = this;
                        // 褰撳墠骞冲彴
                        var client_value = self.application_client_type();
                        // 寰俊闅愮鐘舵€?
                        var is_weixin_privacy = false;
                        // 鏄惁鏈夌綉缁?
                        var is_network = false;
                        // 瀹氭椂楠岃瘉骞惰幏鍙栦綅缃潈闄?
                        self.data.get_user_location_timer = setInterval(function () {
                            // 寰俊鐜銆佸崗璁獙璇佸鐞?
                            // #ifdef MP-WEIXIN
                            uni.getPrivacySetting({
                                success: (res) => {
                                    if (!res.needAuthorization) {
                                        is_weixin_privacy = true;
                                    }
                                },
                            });
                            // #endif

                            // app涓嬪厛瑕佺綉缁?
                            // #ifdef APP
                            uni.getNetworkType({
                                success: function (res) {
                                    if (res.networkType != 'none') {
                                        is_network = true;
                                    }
                                },
                            });
                            // #endif

                            // 鏄惁鍙互璇诲彇浣嶇疆鏉冮檺
                            var status = true;
                            // 寰俊鐜銆佸繀椤诲厛鍚屾剰闅愮鏉冮檺鍚庡啀寮瑰嚭鑾峰彇鐢ㄦ埛浣嶇疆鏉冮檺
                            if(client_value == 'weixin' && !is_weixin_privacy) {
                                status = false;
                            }
                            // app鐜銆佸繀椤诲厛鍒濆鍖栧畬鎴愭湁缃戠粶鍚庡啀寮瑰嚭鑾峰彇鐢ㄦ埛浣嶇疆鏉冮檺
                            if((client_value == 'ios' || client_value == 'android') && !is_network) {
                                status = false;
                            }
                            if(status) {
                                uni.getLocation({
                                    type: 'wgs84',
                                    success: function (res) {
                                        var address = {
                                            name: i18n.t('shopxo-uniapp.app.tghyu3'),
                                            address: '',
                                            lat: res.latitude || null,
                                            lng: res.longitude || null,
                                            status: 1,
                                        };
                                        uni.setStorageSync(cache_key, address);
                                        if (typeof object === 'object' && (method || null) != null) {
                                            object[method](address);
                                        }
                                    }
                                });
                                clearInterval(self.data.get_user_location_timer);
                            }
                        }, 500);
                    }
                }
            },

            // 娓呴櫎瀹氭椂浠诲姟
            clear_interval_handle() {
                // 娓呴櫎鍒濆鍖栧叕鍏辨暟鎹洖璋冩柟娉曞畾鏃朵换鍔?
                clearInterval(this.data.common_data_init_back_timer);
                // 娓呴櫎缃戠粶鐘舵€佹鏌ユ柟娉曞畾鏃朵换鍔?
                var network = this.data.network_type_page_record_timer || null;
                if (network != null) {
                    for (var i in network) {
                        if ((network[i]['timer'] || null) != null) {
                            clearInterval(network[i]['timer']);
                        }
                    }
                }
                this.data.network_type_page_record_timer = null;
                // 娓呴櫎寮瑰嚭浣嶇疆鏉冮檺鎻愮ず瀹氭椂浠诲姟
                clearInterval(this.data.get_user_location_timer);

                // 绉婚櫎寮€灞忓箍鍛婄姸鎬?
                uni.removeStorageSync('plugins_startad_cache_key');
            },

            // 鍟嗗搧璁块棶鏁版嵁瀛樺偍缂撳瓨
            goods_data_cache_handle(goods_id, goods_data = null) {
                var key = this.data.cache_goods_data_key;
                if((goods_data || null) == null) {
                    var res = uni.getStorageSync(key) || null;
                    return (res != null && res.id == goods_id) ? res : null;
                } else {
                    uni.setStorageSync(key, goods_data);
                }
            },

            // 椤甸潰瀵艰埅鏍囬澶勭悊
            set_pages_navigation_bar_title() {
                // 鏍囬
                var value = null;
                // 褰撳墠骞冲彴
                var client_value = this.application_client_type();
                // 褰撳墠椤甸潰鍦板潃
                var url = this.current_page(false);
                // 涓嶅弬涓庤缃〉闈㈡爣棰?
                var no_setup_pages = [
                    'pages/login/login'
                ];
                if(no_setup_pages.indexOf(url) != -1) {
                    return false;
                }
                // 鏀粯瀹濆钩鍙颁互涓嬫潯浠朵笉澧炲姞鏍囬
                if(client_value == 'alipay') {
                    // 鑷畾涔夊ご椤甸潰
                    var pages_always = [
                        'pages/plugins/seckill/index/index',
                        'pages/plugins/points/index/index',
                        'pages/plugins/coupon/index/index',
                        'pages/plugins/signin/detail/detail',
                        'pages/cashier/cashier',
                        'pages/plugins/video/index/index',
                        'pages/plugins/video/detail/detail',
                        'pages/plugins/video/search/search',
                        'pages/plugins/video/search-record/search-record'
                    ];
                    // 褰撳墠tab椤甸潰
                    if(this.is_system_tabbar_pages('/'+url) != -1 || pages_always.indexOf(url) != -1) {
                        value = '';
                    }
                }
                // 杩樻病鏈夋爣棰樺垯鏍规嵁椤甸潰鑷姩澶勭悊
                if(value === null) {
                    // 瑙ｆ瀽澶勭悊key
                    var arr = url.split('/');
                        arr = arr.slice(1);
                        arr = arr.slice(0, -1);
                    var key = 'pages.'+arr.join('-');
                    // 璇诲彇璇█
                    var value = i18n.t(key);
                    // 棣栭〉鍒欒鍙栧綋鍓嶅簲鐢ㄥ悕绉?
                    if(this.app_tabbar_pages()[0] == '/'+url) {
                        value = this.get_application_title();
                    }
                }
                // 璁剧疆鏍囬
                uni.setNavigationBarTitle({
                    title: value || ''
                });
            },

            // 璁剧疆瀵艰埅鑳屾櫙鑹插拰棰滆壊
            set_navigation_bar_color(is_white = null) {
                var color = '#000000';
                var bg_color = '#ffffff';
                var arr = [
                    'pages/index/index',
                ];
                var page = this.current_page(false);
                if(is_white === true || (is_white === null && arr.indexOf(page) != -1)) {
                    color = '#ffffff';
                    bg_color = '#000000';
                }
                uni.setNavigationBarColor({
                    frontColor: color,
                    backgroundColor: bg_color,
                });
            },

            // 搴曢儴娴姩鎸夐挳鏍峰紡澶勭悊
            bottom_fixed_style_handle() {
                var obj = this.get_page_object();
                if(obj != null) {
                    // undefined鍊艰〃绀烘湭瀹氫箟鍒欎笉澶勭悊
                    var temp = obj.bottom_fixed_style == undefined ? ((obj.data || null) == null ? undefined : obj.data.bottom_fixed_style) : '';
                    if(temp !== undefined && this.is_tabbar_pages()) {
                        obj.$vm.setData(
                        {
                            bottom_fixed_style: 'bottom:'+(((this.app_system_tabbar_height_value()-8)*2)+20)+'rpx'
                        });
                    }
                }
            },

            // 椤甸潰鍔犺浇浜嬩欢澶勭悊
            page_event_onload_handle(params) {
                // 鑾峰彇鐢ㄦ埛褰撳墠浣嶇疆
                this.get_user_location();

                // 鏄惁瀛樺湪寮€灞忓箍鍛婃彃浠?
                if(this.is_plugins_startad_status()) {
                    // 绉婚櫎寮€灞忓箍鍛婄姸鎬?
                    uni.removeStorageSync('plugins_startad_cache_key');
                }
            },

            // 椤甸潰灞曠ず浜嬩欢澶勭悊
            page_event_onshow_handle() {
                //闅愯棌绯荤粺tabbar
                this.system_hide_tabbar();

                // 搴曢儴娴姩鎸夐挳鏍峰紡澶勭悊
                this.bottom_fixed_style_handle();

                // 椤甸潰椤堕儴瀵艰埅鏍囬璁剧疆
                this.set_pages_navigation_bar_title();

                // 璁剧疆瀵艰埅鑳屾櫙鑹插拰棰滆壊
                this.set_navigation_bar_color();
            },
        },

        // 鍒濆鍖栧畬鎴愭椂瑙﹀彂锛堝叏灞€鍙Е鍙戜竴娆★級
        onLaunch(params) {
            //闅愯棌绯荤粺tabbar
            this.globalData.system_hide_tabbar();
        },

        // 鍚姩锛屾垨浠庡悗鍙拌繘鍏ュ墠鍙版樉绀?
        onShow(params) {
            //闅愯棌绯荤粺tabbar
            this.globalData.system_hide_tabbar();

            // 鍏叡鏁版嵁鍒濆鍖?
            this.globalData.init_config();

            // 璁剧疆璁惧淇℃伅
            this.globalData.set_system_info();

            // 鍙傛暟澶勭悊+缂撳瓨
            this.globalData.set_launch_cache_info(params);

            // 鍦烘櫙鍊?
            this.globalData.set_scene_data(params);
        },

        // 浠庡墠鍙拌繘鍏ュ悗鍙?
        onHide() {
            this.globalData.clear_interval_handle();
        },

        // 鐩戝惉搴旂敤閫€鍑?
        onExit() {
            this.globalData.clear_interval_handle();
        },
        methods: {},
    };
</script>
<style>
    @import './common/css/page.css';
    @import './common/css/business.css';
    @import './common/css/plugins.css';
    @import './common/css/lib.css';
    @import './common/css/theme.css';
    @import './common/css/muying.css';
    @import './common/css/animation.css';
</style>
