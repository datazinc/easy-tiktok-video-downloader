import { readCatalogs } from "./localization-fixtures.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const strip = source => source.replace(/^import .*;\n/gm, "").replaceAll("export async function ", "async function ").replaceAll("export function ", "function ").replaceAll("export const ", "const ");
const ui = read("src/modules/downloader/ui.js");
const translations = [strip(read("src/modules/i18n/core.js")), `const catalogs = ${JSON.stringify(await readCatalogs())};`, strip(read("src/modules/i18n/index.js"))].join("\n");
const modal = strip(ui.slice(ui.indexOf("export function createModal("), ui.indexOf("export function showMorpheusRateUsPage(")));
const icons = strip(ui.slice(ui.indexOf("export function createIcon("), ui.indexOf("export function updateButtonWithIcon(")));
const helpers = ui.slice(ui.indexOf("function setLocalizedButton("), ui.indexOf("const CHROME_EXTENSION_REVIEW_URL"));
const dialog = ui.slice(ui.indexOf("function notifyDownloadBusy("), ui.indexOf("function makeAccountDownloadControl("));
const templates = strip(ui.slice(ui.indexOf("export function createFilenameTemplateModal("), ui.indexOf("export function createPreferencesBox(")));
const preferences = strip(ui.slice(ui.indexOf("export function createPreferencesBox("), ui.indexOf("export function createSettingsToggle(")));
const stateSource = read("src/modules/state/state.js");
const resetState = strip(stateSource.slice(stateSource.indexOf("export function resetAppStateToDefaults()"), stateSource.indexOf("export default AppState")));
const episodes = ui.slice(ui.indexOf("async function showShortDramaBatchDialog("), ui.indexOf("let accountControlsSyncing"));
const statistics = strip(ui.slice(ui.indexOf("export function showStatsPopUp("), ui.indexOf("export function createModal(")));
const numericStats = ui.slice(ui.indexOf("function formatCompactNumberWithTooltip("), ui.indexOf("export function showStatsSpan("));
const hdProgress = ui.slice(ui.indexOf("function updateExperimentalHdProgress("), ui.indexOf("async function runExperimentalHdDownload("));
const openButton = strip(ui.slice(ui.indexOf("function makeShowButtonDraggable("), ui.indexOf("export function showRateUsPopUpLegacy()")));
const readinessControls = strip(ui.slice(ui.indexOf("export function getReadyVideoDownloadMedia("), ui.indexOf("function syncOverlayExperimentalHdButton(")));
const scraperView = ui.slice(ui.indexOf("function renderActiveScrappingView("), ui.indexOf("async function renderCompletedView("));
const scraperHelp = ui.slice(ui.indexOf("function explainerModal("), ui.indexOf("function showScrapperStateUI("));
const utils = read("src/modules/utils/utils.js");
const recoveryDialog = utils.slice(utils.indexOf("function showDownloadFailureModal("), utils.indexOf("/**\n * Detect the browser type"));
const browserSetup = strip(utils.slice(utils.indexOf("export function showBrowserCompatibilityAlert("), utils.indexOf("\nexport ", utils.indexOf("export function showBrowserCompatibilityAlert(") + 1)));
const endpoint = process.env.ETTPD_BROWSER_URL || "http://127.0.0.1:9223";
const version = await (await fetch(`${endpoint}/json/version`)).json();
const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
let next = 0;
const pending = new Map();
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id); pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
});
const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++next; pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
let targetId;
const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), "ettpd-locales-"));
try {
  ({ targetId } = await call("Target.createTarget", { url: "about:blank" }));
  const { sessionId } = await call("Target.attachToTarget", { targetId, flatten: true });
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const setup = `(async () => {
    const style = document.createElement('style'); style.textContent = ${JSON.stringify(read("src/styles/injex.css"))}; document.head.append(style);
    const persisted = new Map(); const localStorage = { getItem:key=>persisted.get(key)||null, setItem:(key,value)=>persisted.set(key,value), removeItem:key=>persisted.delete(key) };
    globalThis.chrome = {runtime:{id:'fixture'},storage:{local:{get:(key,callback)=>callback({[key]:persisted.get(key)}),set:(data,callback)=>{for(const [key,value] of Object.entries(data))persisted.set(key,value);callback();}},onChanged:{addListener(){}}}};
    ${translations}
    ${strip(read("src/modules/storage/resumeSummary.js"))}
    let theme = 'dark'; const AppState = {downloading:{},ui:{},downloadPreferences:{autoScrollMode:'off',experimentalHd:true},downloadedURLs:[],leaderboard:{allTimeDownloadsCount:1234,weekDownloadsData:{count:56}},recommendationsLeaderboard:{allTimeRecommendationsCount:4321,weekRecommendationsData:{count:78}},scrapperDetails:{}}, DOM_IDS = {MODAL_CONTAINER:'modal-overlay-container',DOWNLOADER_WRAPPER:'ttk-downloader-wrapper',SHOW_DOWNLOADER:'ettpd-show'}, DEFAULT_BATCH_SIZE = 30;
    const STORAGE_KEYS = new Proxy({}, {get:(_,key)=>key}), DOWNLOAD_FOLDER_DEFAULT='Easy TikTok Video Downloader';
    const presets=[{label:'Original preset',messageKey:'presetRecommended',template:'@/@{authorUsername}/{videoId}.mp4',example:'@creator/123.mp4',isRecommended:true,isDefault:true}];
    const FILE_STORAGE_LOCATION_TEMPLATE_PRESETS=presets;
    AppState.downloadPreferences.fullPathTemplate=presets[0];
    const getSavedTemplates=()=>[],getPresetTemplates=()=>presets,getRecommendedPresetTemplate=()=>presets[0],saveTemplates=()=>{},saveSelectedTemplate=()=>{},listScrollingCompleted=()=>false,canClickNextButton=()=>false,getCurrentPageUsername=()=> 'creator',loadProgress=async()=>[];
    ${resetState}
    const getDownloadFilePath=sample=>'@creator/'+sample.videoId+'.mp4';
    const pollInitialData=()=>{};
    const detectBrowserType=()=> 'brave',getExtensionReviewTarget=()=>({url:'https://example.org',storeLabel:'Store'}),isExtensionEnabledSync=()=>true;
    const showCelebration=()=>{},getAllTimeLeaderBoardList=()=>[{username:'creator',count:1234}],getWeeklyLeaderBoardList=()=>[{username:'creator',count:56}],getAllTimeRecommendationsLeaderBoardList=()=>[],getWeeklyRecommendationsLeaderBoardList=()=>[],getUserDownloadsCurrentTier=()=>({emoji:'',name:t('level',{count:3})}),getUserRecommendationsCurrentTier=getUserDownloadsCurrentTier;
    const getShortDramaId=()=> '123',resolveShortDramaRequest=()=>'',collectShortDramaEpisodes=async()=>({title:'Series',total:3,episodes:[1,2,3].map(number=>({id:String(number),number}))}),getEpisodeNumber=item=>item.number,buildVideoLinkMeta=item=>({videoId:item.id}),getReadyVideoDownloadMedia=(_,items)=>items[0];
    const downloadRecovery={operation:{refreshCount:1},canRefresh:()=>false}, updateBatchDownloadProgress=()=>{},escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const claimAutomaticPopup=()=>true,uuid=()=>crypto.randomUUID();
    const getResolvedThemeMode=()=>theme,resolveAccountList=()=>({kind:'collection',scope:'collection:123'}),getProgressiveListCheckpoint=()=>({scope:'collection:123',completed:['1','2','3'],skipped:['4'],pending:['5','6','7','8'],batchSize:30,maxPosts:10,finished:false}),sessionStorage={};
    class ProgressiveBatch {readChunk(){return {queue:[{videoId:'5',key:'5:v',lastFailure:true,status:'pending'},{videoId:'6',key:'6:v',status:'saved'}],saves:[{key:'6:v',downloadId:10}]};}}
    const showToast=()=>{},displayFoundUrls=()=>{},replaceElementHtml=(element,html)=>{const svg=element.namespaceURI==='http://www.w3.org/2000/svg';const parsed=new DOMParser().parseFromString(svg?'<svg xmlns="http://www.w3.org/2000/svg">'+html+'</svg>':html,svg?'image/svg+xml':'text/html');element.replaceChildren(...(svg?parsed.documentElement:parsed.body).childNodes);localizeMarkup(element);};
    ${icons}\n${modal}\n${helpers}\n${dialog}\n${templates}\n${preferences}\n${episodes}\n${numericStats}\n${statistics}\n${hdProgress}\n${openButton}\n${scraperView}\n${scraperHelp}\n${recoveryDialog}\n${browserSetup}\n${strip(read("src/modules/utils/payItForward.js"))}
    initializeI18n(); onLanguageChange(()=>{for(const button of document.querySelectorAll('[data-i18n-button]'))setButtonWithIcon(button,t(button.dataset.i18nButton,button._i18nValues||{}),button.dataset.i18nIcon||null);});
    window.renderLocale=async(locale,font,dark)=>{document.body.replaceChildren();theme=dark?'dark':'classic';document.body.style.cssText='margin:0;background:'+(dark?'#111':'#fff')+';font-size:'+font+'px';await setLanguage(locale);document.body.append(createLanguageControl());await showAccountBatchDialog({kind:'collection',id:'123',title:'Summer of Sports'});const box=document.querySelector('.ettpd-modal-box');const actions=[...box.querySelectorAll('button')].filter(button=>button.getBoundingClientRect().height>0);actions.at(-1).scrollIntoView({block:'nearest'});const bounds=box.getBoundingClientRect();return {locale:getLocale(),overflow:box.scrollWidth>box.clientWidth+1,summary:[...box.querySelectorAll('dl dd')].map(element=>element.textContent),actions:actions.map(button=>({text:button.textContent,within:button.getBoundingClientRect().left>=bounds.left&&button.getBoundingClientRect().right<=bounds.right}))};};
    window.switchEnglish=async()=>{await setLanguage('en');return {locale:getLocale(),button:document.querySelector('.ettpd-modal-box button[type=submit]').textContent};};
    window.renderScreen=async(screen,locale)=>{
      document.querySelector('.ettpd-modal-close')?.click();document.querySelector('dialog')?.close();document.body.replaceChildren();
      theme=innerWidth<=320?'classic':'dark';document.body.style.fontSize=innerWidth<=320?'20px':'16px';
      await setLanguage(locale);AppState.ui.isPreferenceBoxOpen=true;
      if(screen==='settings') createModal({children:[createPreferencesBox()]});
      if(screen==='templates') createFilenameTemplateModal();
      if(screen==='episodes') await showShortDramaBatchDialog('123',{dataset:{},disabled:false});
      if(screen==='statistics') showStatsPopUp();
      if(screen==='kindness') showPayItForwardDialog({dark:theme==='dark'});
      if(screen==='recovery') void showDownloadFailureModal({filename:'@creator/123.mp4',url:'blob:fixture'});
      if(screen==='browser') showBrowserCompatibilityAlert();
      if(screen==='scraper-help') explainerModal('videos');
      if(screen==='scraper') {AppState.allDirectLinks=[{url:'a'},{url:'b'}];AppState.scrapperDetails={selectedTab:'videos',originalUsername:'creator',scrappingStage:'ongoing'};createModal({children:[renderActiveScrappingView()]});}
      const box=document.querySelector('.ettpd-modal-box,dialog');
      if(!box)throw new Error('No screen: '+screen);
      const bounds=box.getBoundingClientRect();
      return {overflow:box.scrollWidth>box.clientWidth+1,empty:[...box.querySelectorAll('[data-i18n]')].some(element=>!element.textContent.trim()),buttons:[...box.querySelectorAll('button')].filter(button=>button.getBoundingClientRect().width>0).map(button=>({text:button.textContent,within:button.getBoundingClientRect().left>=bounds.left-1&&button.getBoundingClientRect().right<=bounds.right+1}))};
    };
    window.checkLiveProgress=async()=>{
      document.querySelector('.ettpd-modal-close')?.click();document.body.replaceChildren();await setLanguage('en');
      const button=document.createElement('button');document.body.append(button);bindText(button,'download');
      updateExperimentalHdProgress(button,{phase:'mux',progress:0.5});const before=button.querySelector('.ettpd-hd-progress-fill').style.width;
      const track=button.querySelector('.ettpd-hd-progress-track'),fill=track.firstElementChild;
      await setLanguage('de');
      const translatedPhase=button.querySelector('.ettpd-hd-progress-label')?.textContent;
      const stages=[];
      for(const status of [{phase:'fetch',progress:0.9,quality:'hd'},{phase:'mux',progress:0},{phase:'fallback',progress:null,quality:'standard'},{phase:'fetch',progress:0.1},{phase:'save',progress:1}]){
        updateExperimentalHdProgress(button,status);
        stages.push({sameTrack:button.querySelector('.ettpd-hd-progress-track')===track,sameFill:track.firstElementChild===fill,text:button.textContent,indeterminate:fill.classList.contains('is-indeterminate')});
      }
      return {phase:translatedPhase,fill:fill.style.width,before,expected:catalogs.de.mux,stages};
    };
    window.checkTemplateDraft=async()=>{
      await window.renderScreen('templates','en');const input=document.querySelector('input[name=template]');input.value='custom/{videoId}.mp4';input.dispatchEvent(new Event('input'));
      await setLanguage('id');return {value:input.value,heading:document.querySelector('.ettpd-template-title').textContent,expected:catalogs.id.templateTitle};
    };
    window.renderPopup=async(locale)=>{document.body.innerHTML=${JSON.stringify(read("src/popup/popup.html").match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[^>]*>[\s\S]*?<\/script>/g, ""))};style.textContent=${JSON.stringify(read("src/popup/popup.css"))};document.body.style.cssText='margin:0';await setLanguage(locale);localizeMarkup();document.querySelector('.popup-hero').prepend(createLanguageControl('btn secondary'));return {heading:document.querySelector('.popup-hero h1').textContent,overflow:document.documentElement.scrollWidth>innerWidth+1};};
    window.renderLanguagePicker=async(locale,dark,popup)=>{
      document.querySelector('.ettpd-modal-close')?.click();document.querySelector('dialog')?.close();
      document.body.replaceChildren();theme=dark?'dark':'classic';
      document.documentElement.classList.toggle('theme-dark',dark);
      document.body.style.cssText='margin:0;font-size:24px';
      style.textContent=popup?${JSON.stringify(read("src/popup/popup.css"))}:${JSON.stringify(read("src/styles/injex.css"))};
      await setLanguage(locale);
      const trigger=popup?createLanguageControl('btn secondary'):createLanguageControl('ettpd-icon-btn',{getTheme:getResolvedThemeMode});
      document.body.append(trigger);
      const reference=popup?document.createElement('div'):createModal({children:[]});
      if(popup){reference.className='past-downloads-content';document.body.append(reference);}
      const referenceBox=popup?reference:reference.querySelector('.ettpd-modal-box');
      const referenceButton=document.createElement('button');referenceButton.className=popup?'btn secondary':'ettpd-modal-button secondary';referenceBox.append(referenceButton);
      const surface=element=>{const css=getComputedStyle(element);return Object.fromEntries(['backgroundColor','backgroundImage','borderRadius','borderTopColor','fontFamily','boxShadow','color'].map(key=>[key,css[key]]));};
      const expected=surface(referenceBox),expectedButton=surface(referenceButton);reference.remove();
      trigger.click();
      const picker=document.getElementById('ettpd-language-dialog'),box=picker.querySelector('.ettpd-modal-box'),select=picker.querySelector('select'),close=picker.querySelector('button');
      window.pickerClosed=new Promise(resolve=>picker.addEventListener('close',()=>resolve({removed:!picker.isConnected,focused:document.activeElement===trigger}),{once:true}));
      const bounds=box.getBoundingClientRect();
      return {expected,actual:surface(box),expectedButton,actualButton:surface(close),focused:document.activeElement===select,inlineStyles:picker.querySelectorAll('[style]').length,overflow:box.scrollWidth>box.clientWidth+1,within:bounds.left>=0&&bounds.right<=innerWidth&&bounds.top>=0&&bounds.bottom<=innerHeight,headingSize:parseFloat(getComputedStyle(picker.querySelector('h3')).fontSize)};
    };
    window.checkOpenButtonPosition=async()=>{
      document.querySelector('.ettpd-modal-close')?.click();document.querySelector('dialog')?.close();document.body.replaceChildren();await setLanguage('en');
      style.textContent=${JSON.stringify(read("src/styles/injex.css"))};AppState.ui.hasSeenShowButtonHint=true;
      localStorage.removeItem(STORAGE_KEYS.SHOW_BUTTON_POSITION);
      const location=()=>{const rect=document.getElementById(DOM_IDS.SHOW_DOWNLOADER).getBoundingClientRect();return {left:rect.left,bottom:innerHeight-rect.bottom,right:rect.right,top:rect.top};};
      hideDownloader();const first=location();const button=document.getElementById(DOM_IDS.SHOW_DOWNLOADER);
      button.dispatchEvent(new MouseEvent('mousedown',{clientX:first.left+10,clientY:first.top+10,bubbles:true}));
      document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const clickSaved=localStorage.getItem(STORAGE_KEYS.SHOW_BUTTON_POSITION);
      button._cleanupDraggable();button.remove();hideDownloader();const reopened=location();
      localStorage.setItem(STORAGE_KEYS.SHOW_BUTTON_POSITION,JSON.stringify({left:innerWidth+100,top:innerHeight+100}));
      const second=document.getElementById(DOM_IDS.SHOW_DOWNLOADER);second._cleanupDraggable();second.remove();hideDownloader();
      await new Promise(resolve=>setTimeout(resolve,0));const clamped=location();
      resetShowButtonPosition();const reset=location();
      document.getElementById(DOM_IDS.SHOW_DOWNLOADER)._cleanupDraggable();document.body.replaceChildren();
      return {first,reopened,clickSaved,clamped,reset,width:innerWidth,height:innerHeight};
    };
    window.checkFactoryReset=async()=>{
      document.querySelector('.ettpd-modal-close')?.click();document.querySelector('dialog')?.close();document.body.replaceChildren();await setLanguage('en');
      AppState.ui.isPreferenceBoxOpen=true;AppState.ui.isDownloaderClosed=true;AppState.downloadPreferences.experimentalHd=false;
      AppState.debug={active:false};
      const wrapper=document.createElement('div');wrapper.id=DOM_IDS.DOWNLOADER_WRAPPER;
      const shortcut=document.createElement('button');shortcut.id=DOM_IDS.SHOW_DOWNLOADER;
      const preferences=createPreferencesBox();wrapper.append(preferences);document.body.append(wrapper,shortcut);
      const checkbox=preferences.querySelector('input[name=experimentalHd]');
      if(checkbox.checked)throw new Error('Reset fixture must start with HD off');
      await preferences.querySelector('.ettpd-options-buttons button').onclick({stopPropagation(){}});
      const freshPreferences=createPreferencesBox();
      return {hd:AppState.downloadPreferences.experimentalHd,closed:AppState.ui.isDownloaderClosed,settingsOpen:AppState.ui.isPreferenceBoxOpen,oldWrapperRemoved:!wrapper.isConnected,shortcutRemoved:!shortcut.isConnected,freshCheckbox:freshPreferences.querySelector('input[name=experimentalHd]').checked};
    };
    window.checkReadinessRetry=async()=>{
      document.querySelector('.ettpd-modal-close')?.click();document.querySelector('dialog')?.close();document.body.replaceChildren();await setLanguage('en');
      let now=10000,local=null,requests=0,saved=null;
      const Date={now:()=>now},AppState={allDirectLinks:[],allItemsEverSeen:{},debug:{active:false}};
      const findFiberItemById=()=>local?{item:local}:null,buildVideoLinkMeta=item=>item;
      const getDownloadActionLabel=()=> 'SD',getStandardDownloadTitle=()=> 'Standard source with audio',syncOverlayExperimentalHdButton=()=>{};
      const hydrateTikTokVideoDetail=async()=>{requests++;return null;},handleFoundItems=items=>{AppState.allDirectLinks=items;};
      const runStandardDownload=async(button,media)=>{saved=media.url;};
      ${readinessControls}
      const parent=document.createElement('div');document.body.append(parent);
      createDownloadButton({parentEl:parent,videoId:'123',author:'user',getVideoSrc:()=> 'blob:playback',isImage:false});
      const container=parent.querySelector('.download-btn-container'),button=container.querySelector('button');
      container.dispatchEvent(new Event('pointerenter'));
      const loading=button.dataset.sourceState;
      await new Promise(resolve=>setTimeout(resolve,0));
      const failed={state:button.dataset.sourceState,disabled:button.disabled};
      now+=20000;button._refreshSourceReadiness();
      const expired={state:button.dataset.sourceState,disabled:button.disabled};
      await setLanguage('fr');const translated=button.title===t('retry');
      button.click();await new Promise(resolve=>setTimeout(resolve,0));
      const retried=requests;
      const restarting={state:button.dataset.sourceState,disabled:button.disabled};
      local={videoId:'123',id:'123',videoSources:[{url:'https://example.org/verified.mp4',audioStatus:'muxed'}]};
      button._refreshSourceReadiness();const ready={state:button.dataset.sourceState,disabled:button.disabled};
      button.click();await new Promise(resolve=>setTimeout(resolve,0));
      return {loading,failed,expired,translated,retried,restarting,ready,saved,requests};
    };
    return Object.keys(SUPPORTED_LOCALES);
  })()`;
  const locales = await evaluate(setup);
  for (const width of [320, 1200]) for (const locale of locales) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    const result = await evaluate(`renderLocale(${JSON.stringify(locale)},${width === 320 ? 20 : 16},${width === 1200})`);
    assert.equal(result.overflow, false, `${locale}/${width}: overflow`);
    assert.ok(result.actions.every(action => action.within), `${locale}/${width}: clipped action`);
    assert.equal(result.summary.length, 6);
    const summaryLayout = await evaluate(`(()=>{const labels=[...document.querySelectorAll('.ettpd-resume-summary dt')];return labels.map(label=>({width:label.getBoundingClientRect().width,height:label.getBoundingClientRect().height}));})()`);
    assert.ok(summaryLayout.every(label => label.width >= 85 && label.height < 160), `${locale}/${width}: summary columns are too narrow`);
    const image = await call("Page.captureScreenshot", { format: "png" }, sessionId);
    fs.writeFileSync(path.join(screenshots, `${locale}-${width}.png`), Buffer.from(image.data, "base64"));
    console.log(`${locale}/${width}: no clipping; ${result.actions.map(action => action.text).join(" / ")}`);
  }
  const switched = await evaluate("switchEnglish()");
  assert.equal(switched.locale, "en"); assert.equal(switched.button, "Resume download");
  for (const width of [320, 1200]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    for (const screen of ["settings", "templates", "episodes", "statistics", "kindness", "recovery", "browser", "scraper-help", "scraper"]) for (const locale of locales) {
      const result = await evaluate(`renderScreen(${JSON.stringify(screen)},${JSON.stringify(locale)})`);
      assert.equal(result.overflow, false, `${screen}/${locale}/${width}: overflow`);
      assert.equal(result.empty, false, `${screen}/${locale}/${width}: untranslated markup`);
      assert.ok(result.buttons.every(button => button.within), `${screen}/${locale}/${width}: clipped button`);
      const image = await call("Page.captureScreenshot", { format: "png" }, sessionId);
      fs.writeFileSync(path.join(screenshots, `${screen}-${locale}-${width}.png`), Buffer.from(image.data, "base64"));
    }
  }
  const locations = await evaluate("checkOpenButtonPosition()");
  assert.equal(locations.first.left, 20);
  assert.equal(locations.first.bottom, 50);
  assert.deepEqual(locations.reopened, locations.first);
  assert.equal(locations.clickSaved, null);
  assert.ok(locations.clamped.left >= 0 && locations.clamped.right <= locations.width && locations.clamped.top >= 0);
  assert.equal(locations.reset.left, 20);
  assert.equal(locations.reset.bottom, 50);
  console.log("Real DOM: Open stays bottom-left across close/reopen; custom positions clamp and reset correctly.");
  const reset = await evaluate("checkFactoryReset()");
  assert.deepEqual(reset, { hd: true, closed: false, settingsOpen: false, oldWrapperRemoved: true, shortcutRemoved: true, freshCheckbox: true });
  console.log("Real DOM: factory reset restores HD on, downloader open, and rebuilt controls.");
  const readiness = await evaluate("checkReadinessRetry()");
  assert.equal(readiness.loading, "loading");
  assert.deepEqual(readiness.failed, { state: "loading", disabled: true });
  assert.deepEqual(readiness.expired, { state: "unavailable", disabled: false });
  assert.equal(readiness.translated, true);
  assert.equal(readiness.retried, 2);
  assert.deepEqual(readiness.restarting, { state: "loading", disabled: true });
  assert.deepEqual(readiness.ready, { state: "ready", disabled: false });
  assert.equal(readiness.saved, "https://example.org/verified.mp4");
  assert.equal(readiness.requests, 2, "Late local metadata must not require another request");
  console.log("Real DOM: no early unavailable flash; timeout allows retry, and late metadata restores readiness.");
  const liveProgress = await evaluate("checkLiveProgress()");
  assert.ok(liveProgress.phase.includes(liveProgress.expected));
  assert.equal(liveProgress.fill, liveProgress.before);
  assert.ok(liveProgress.stages.every(stage => stage.sameTrack && stage.sameFill && stage.indeterminate));
  assert.ok(liveProgress.stages.every(stage => !/\d+%/.test(stage.text)));
  console.log("Real DOM: one persistent percentage-free HD indicator across transfer, mux, fallback and save.");
  const draft = await evaluate("checkTemplateDraft()");
  assert.equal(draft.value, "custom/{videoId}.mp4");
  assert.equal(draft.heading, draft.expected);
  await call("Emulation.setDeviceMetricsOverride", { width: 520, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  for (const locale of locales) {
    const popup = await evaluate(`renderPopup(${JSON.stringify(locale)})`);
    assert.equal(popup.overflow, false, `${locale}: popup overflow`);
    assert.ok(popup.heading);
    const popupSizing = await evaluate(`({documentWidth:getComputedStyle(document.documentElement).width,badgeHeight:document.querySelector('.badge').getBoundingClientRect().height,headingHeight:document.querySelector('.popup-hero h1').getBoundingClientRect().height})`);
    assert.equal(popupSizing.documentWidth, "520px", `${locale}: missing intrinsic popup width`);
    assert.ok(popupSizing.badgeHeight < 70 && popupSizing.headingHeight < 100, `${locale}: popup text collapsed into narrow columns`);
    const image = await call("Page.captureScreenshot", { format: "png" }, sessionId);
    fs.writeFileSync(path.join(screenshots, `${locale}-popup.png`), Buffer.from(image.data, "base64"));
  }
  for (const popup of [false, true]) for (const dark of [false, true]) for (const width of [320, 1200]) for (const locale of locales) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    const result = await evaluate(`renderLanguagePicker(${JSON.stringify(locale)},${dark},${popup})`);
    const label = `language-${popup ? "popup" : "page"}-${dark ? "dark" : "light"}-${locale}-${width}`;
    assert.deepEqual(result.actual, result.expected, `${label}: differs from shared modal surface`);
    assert.deepEqual(result.actualButton, result.expectedButton, `${label}: differs from shared secondary button`);
    assert.equal(result.inlineStyles, 0, `${label}: inline visual styles`);
    assert.equal(result.overflow, false, `${label}: overflow`);
    assert.equal(result.within, true, `${label}: outside viewport`);
    assert.equal(result.focused, true, `${label}: select not focused`);
    assert.ok(result.headingSize <= 22, `${label}: oversized heading`);
    const image = await call("Page.captureScreenshot", { format: "png" }, sessionId);
    fs.writeFileSync(path.join(screenshots, `${label}.png`), Buffer.from(image.data, "base64"));
    if (width === 320) {
      await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, sessionId);
      await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, sessionId);
    } else {
      await evaluate("document.getElementById('ettpd-language-dialog').click()");
    }
    assert.deepEqual(await evaluate("pickerClosed"), { removed: true, focused: true }, `${label}: dismissal/focus return`);
  }
  console.log(`Language picker matches shared styles in 88 theme/locale/viewport cases; Escape, backdrop and focus return pass.`);
  console.log(`Live English override passed. Screenshots: ${screenshots}`);
} finally {
  if (targetId) await call("Target.closeTarget", { targetId });
  socket.close();
}