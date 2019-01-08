import Vue from 'vue'
import { mapGetters } from 'vuex'
import Sidebar from './components/index.vue'
import Utils from '../libs/utils'
import Dict from '../mixins/dict'
import Store from './store'
import State from './store.state'
import Getters from './store.getters'

Vue.mixin(Dict)

export default new Vue({
  el: '#root',
  store: Store,

  components: {
    Sidebar,
  },

  data() {
    return {}
  },

  computed: {
    ...mapGetters(['fontSize', 'defaultCtxId', 'panels']),

    nativeScrollbarsClass() {
      return State.nativeScrollbars ? '-native-scroll' : '-custom-scroll'
    },

    themeClass() {
      return '-' + State.theme
    },

    animateClass() {
      if (State.animations) return '-animate'
      else return '-no-animate'
    },
  },

  watch: {
    fontSize() {
      Store.dispatch('updateFontSize')
    },
  },

  beforeCreate() {
    browser.windows.getCurrent()
      .then(win => {
        State.private = win.incognito
        State.windowId = win.id
      })

    browser.runtime.getPlatformInfo()
      .then(osInfo => {
        State.osInfo = osInfo
        State.os = osInfo.os
      })

    browser.runtime.getBrowserInfo()
      .then(ffInfo => {
        State.ffInfo = ffInfo
        State.ffVer = parseInt(ffInfo.version.slice(0, 2))
        if (isNaN(State.ffVer)) State.ffVer = 0
      })
  },

  async created() {
    browser.windows.onFocusChanged.addListener(this.onFocusWindow)
    browser.storage.onChanged.addListener(this.onChangeStorage)
    browser.commands.onCommand.addListener(this.onCmd)

    await Store.dispatch('loadSettings')
    await Store.dispatch('loadState')
    Store.dispatch('updateProxiedTabs')
    Store.dispatch('loadKebindings')
    await Store.dispatch('loadLocalID')
    Store.dispatch('loadSyncPanels')
    Store.dispatch('loadSnapshots')
    Store.dispatch('loadFavicons')
    Store.dispatch('loadPermissions')
    await Store.dispatch('loadBookmarks')

    const dSavingState = Utils.Debounce(() => Store.dispatch('saveState'), 567)
    Store.watch(Getters.activePanel, dSavingState.func)

    const dMakingSnapshot = Utils.Debounce(() => Store.dispatch('makeSnapshot'), 10000)
    Store.watch(Getters.tabs, dMakingSnapshot.func)

    // Try to clear unneeded favicons
    Store.dispatch('tryClearFaviCache', 86400)
  },

  mounted() {
    Store.dispatch('updateFontSize')
  },

  beforeDestroy() {
    browser.windows.onFocusChanged.removeListener(this.onFocusWindow)
    browser.storage.onChanged.removeListener(this.onChangeStorage)
    browser.commands.onCommand.removeListener(this.onCmd)
  },

  methods: {
    /**
     * Set currently focused window
     */
    onFocusWindow(id) {
      this.windowFocused = id === State.windowId
    },

    /**
     * Handle changes of all storages (update current state)
     */
    onChangeStorage(changes, type) {
      if (changes.settings) Store.dispatch('loadSettings')
      if (type === 'sync') {
        let ids = Object.keys(changes).filter(id => id !== this.localID)

        let syncData
        ids.map(id => {
          if (!changes[id] || !changes[id].newValue) return
          let data

          try {
            data = JSON.parse(changes[id].newValue)
          } catch (err) {
            return
          }

          if (syncData && syncData.time > data.time) return
          else syncData = data
        })
        this.lastSyncPanels = syncData

        Store.dispatch('updateSyncPanels', syncData)
      }
    },

    /**
     * Keybindings handler
     */
    onCmd(name) {
      if (!State.windowFocused) return
      let cmdName = 'kb_' + name
      Store.dispatch(cmdName)
    },
  },
})