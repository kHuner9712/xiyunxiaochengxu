import Vue from 'vue';
import App from './App';

// 鍏ㄥ眬mixins
import base from './common/js/common/base';
import share from './common/js/common/share';

// 澶氳瑷€寮曞叆骞跺垵濮嬪寲
import i18n from './locale/index'
// iconfont 由 easycom 按需注入，不再做全局注册

Vue.mixin(base);
Vue.mixin(share);

Vue.config.productionTip = false;
App.mpType = 'app';

const app = new Vue({
    i18n,
    ...App
});
app.$mount();
