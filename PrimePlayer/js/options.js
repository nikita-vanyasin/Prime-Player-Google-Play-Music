/**
 * This is the script for the options page.
 * @author Sven Ackermann (svenrecknagel@googlemail.com)
 * @license BSD license
 */
chrome.runtime.getBackgroundPage(function(bp) {

  var thisTabId;

  /** request and store last.fm session info */
  function getLastfmSession(token) {
    var status = $("#lastfmStatus");
    status.find(".loader").show();
    bp.lastfm.auth.getSession({token: token},
      {
        success: function(response) {
          status.find(".loader").hide();
          bp.localSettings.lastfmSessionKey = response.session.key;
          bp.localSettings.lastfmSessionName = response.session.name;
          bp.lastfm.session = response.session;
          status.find(".success").attr("title", chrome.i18n.getMessage("lastfmConnectSuccess")).show();
          bp.gaEvent("LastFM", "AuthorizeOK");
          bp.getCurrentLastfmInfo();
          bp.scrobbleCachedSongs();
        },
        error: function(code, message) {
          status.find(".loader").hide();
          var title = chrome.i18n.getMessage("lastfmConnectError");
          if (message) title += ": " + message;
          status.find(".failure").attr("title", title).show();
          bp.gaEvent("LastFM", "AuthorizeError-" + code);
        }
      }
    );
  }

  function scrobbleChanged(val) {
    $("#scrobblePercent, #scrobbleTime, #scrobbleMaxDuration, #disableScrobbleOnFf, #showScrobbledIndicator, #scrobbleRepeated").prop("disabled", !bp.isScrobblingEnabled());
    $("#scrobble").prop("checked", val);
  }

  function linkRatingsChanged() {
    $("#linkRatingsGpm").prop("disabled", !bp.settings.linkRatings || !bp.localSettings.lastfmSessionName);
  }
  
  function toastChanged() {
    $("#toastIfMpOpen, #toastDuration").prop("disabled", !bp.settings.toast);
    $("#toastUseMpStyle").prop("disabled", !bp.settings.toast || !bp.localSettings.notificationsEnabled);
    $("#toastClick, #toastButton1, #toastButton2, #toastProgress").prop("disabled", !bp.settings.toast || bp.settings.toastUseMpStyle);
  }
  
  function lyricsChanged() {
    $("#openLyricsInMiniplayer, #lyricsInGpm, #lyricsAutoReload").prop("disabled", !bp.localSettings.lyrics);
    $("#lyricsFontSize, #lyricsWidth").prop("disabled", !bp.localSettings.lyrics || !bp.settings.lyricsInGpm);
  }
  
  function lastfmUserChanged(user) {
    var action;
    var actionText;
    $("#scrobble, #linkRatings, #showLovedIndicator").prop("disabled", !user);
    scrobbleChanged(bp.settings.scrobble);
    linkRatingsChanged();
    var links = $("#lastfmStatus").find("a");
    var userLink = links.first();
    if (user) {
      action = bp.lastfmLogout;
      actionText = chrome.i18n.getMessage("logout");
      userLink.text(user).attr("href", "http://last.fm/user/" + user).removeClass("disconnected");
    } else {
      action = bp.lastfmLogin;
      actionText = chrome.i18n.getMessage("connect");
      userLink.text(chrome.i18n.getMessage("disconnected")).removeAttr("href").addClass("disconnected");
    }
    links.last().text(actionText).unbind().click(action);
  }

  function notificationsEnabledChanged(val) {
    $("#settings").toggleClass("notifDisabled", !val);
    if (!val && bp.settings.toast && !bp.settings.toastUseMpStyle) $("#toastUseMpStyle").click();
    else toastChanged();
  }
  
  function stringUpdater(prop) {
    return function() {
      bp.settings[prop] = $(this).val();
    };
  }

  function numberUpdater(prop, settings) {
    return function() {
      settings[prop] = parseFloat($(this).val());
    };
  }

  function boolUpdater(prop, settings) {
    return function() {
      settings[prop] = !settings[prop];
    };
  }

  function appendHint(container) {
    var hint = $("<p class='hint-text'></p>");
    $("<img src='img/hint.png' class='hint'/>").click(function() {hint.slideToggle("fast");}).appendTo(container);
    return hint;
  }
  
  /** the i18n key for the hint for property "<prop>" is "setting_<prop>Hint" */
  function initHint(prop) {
    var container = $("#" + prop).parent();
    var hint = appendHint(container);
    hint.html(chrome.i18n.getMessage("setting_" + prop + "Hint")).appendTo(container);
    return hint;
  }

  /** the i18n key for the label for property "<prop>" is "setting_<prop>" */
  function setLabel(prop) {
    $("label[for='" + prop + "']").text(chrome.i18n.getMessage("setting_" + prop));
  }
  
  function initCheckbox(prop, settings) {
    if (!settings) settings = bp.settings;
    var input = $("#" + prop);
    input
      .prop("checked", settings[prop])
      .click(boolUpdater(prop, settings));
    setLabel(prop);
    return input;
  }

  function initNumberInput(prop, settings) {
    if (!settings) settings = bp.settings;
    var input = $("#" + prop);
    input
      .val(settings[prop])
      .blur(numberUpdater(prop, settings));
    setLabel(prop);
    return input;
  }

  /** the i18n key for option "<opt>" for property "<prop>" is "setting_<prop>_<opt>" */
  function initSelect(prop, getOptionText, updater) {
    if (typeof(getOptionText) != "function") {
      getOptionText = function(val) {return chrome.i18n.getMessage("setting_" + prop + "_" + val);};
    }
    if (typeof(updater) != "function") updater = stringUpdater;
    var input = $("#" + prop);
    input
      .val(bp.settings[prop])
      .change(updater(prop))
      .find("option").each(function() {
        $(this).text(getOptionText($(this).attr("value")));
      });
    setLabel(prop);
    return input;
  }
  
  function initColorInput(prop) {
    var input = $("#" + prop);
    input
      .val(bp.settings[prop])
      .change(stringUpdater(prop, bp.settings));
    setLabel(prop);
    return input;
  }
  
  function initIconStyle() {
    setLabel("iconStyle");
    $("#iconStyle").find("input[value='" + bp.settings.iconStyle + "']").prop("checked", true);
    $("#iconStyle").find("input").click(stringUpdater("iconStyle"));
  }
  
  function initLyrics() {
    var lyrics = initCheckbox("lyrics", bp.localSettings).unbind();
    function enableCheckBox() {
      lyrics.unbind().click(boolUpdater("lyrics", bp.localSettings)).click(lyricsChanged);
    }
    var perm = { origins: ["http://www.songlyrics.com/*"] };
    chrome.permissions.contains(perm, function(result) {
      if (result) {
        enableCheckBox();
      } else {
        lyrics.click(function() {
          alert(chrome.i18n.getMessage("lyricsAlert"));
          chrome.permissions.request(perm, function(granted) {
            if (granted) {
              bp.localSettings.lyrics = true;
              lyricsChanged();
              enableCheckBox();
            } else {
              lyrics.prop("checked", false);
            }
          });
        });
      }
    });
  }

  function iconClickChanged() {
    if (!bp.settings.iconClickAction0) bp.settings.iconClickAction1 = "";
    if (!bp.settings.iconClickAction1) bp.settings.iconClickAction2 = "";
    if (!bp.settings.iconClickAction2) bp.settings.iconClickAction3 = "";
    var ict = $("#iconDoubleClickTime").prop("disabled", !bp.settings.iconClickAction0).val();
    $("#iconClickAction1").prop("disabled", !bp.settings.iconClickAction0 || ict === 0).val(bp.settings.iconClickAction1);
    $("#iconClickAction2").prop("disabled", !bp.settings.iconClickAction1 || ict === 0).val(bp.settings.iconClickAction2);
    $("#iconClickAction3").prop("disabled", !bp.settings.iconClickAction2 || ict === 0).val(bp.settings.iconClickAction3);
  }
  
  function showProgressChanged() {
    $("#showProgressColor").prop("disabled", !bp.settings.showProgress);
  }
  
  /** @return version from a class attribute (e.g. for an element with class "abc v-1.2.3 def" this returns "1.2.3") */
  function extractVersionFromClass(el) {
    var cl = $(el).attr("class");
    var start = cl.indexOf("v-") + 2;
    if (start < 0) return null;
    var end = cl.indexOf(" ", start);
    return cl.substring(start, end < 0 ? cl.length : end);
  }
  
  function updateTimerStatus() {
    var countDown = Math.floor(bp.timerEnd - (new Date().getTime() / 1000));
    if (countDown > 0) {
      $("#timerStatus").text(chrome.i18n.getMessage("timerAction_" + bp.localSettings.timerAction) + " in " + bp.toTimeString(countDown));
      setTimeout(updateTimerStatus, 1000);
    } else {
      $("#timerStatus").empty();
    }
    $("#startTimer, #timerMin, #timerNotify, #timerPreNotify, #timerAction").prop("disabled", !bp.player.connected || countDown > 0);
    $("#stopTimer").prop("disabled", !bp.player.connected || countDown <= 0);
  }
  
  function initTimer() {
    function updatePreNotifyMax() {
      $("#timerPreNotify").attr("max", $("#timerMin").val() * 60);
    }
    $("#timerMin").val(bp.localSettings.timerMinutes).change(updatePreNotifyMax).parent().find("label").text(chrome.i18n.getMessage("timerMinutes"));
    $("#timerNotify").prop("checked", bp.localSettings.timerNotify).parent().find("label").text(chrome.i18n.getMessage("timerNotify"));
    $("#timerPreNotify").val(bp.localSettings.timerPreNotify).parent().find("label").text(chrome.i18n.getMessage("timerPreNotify"));
    $("#timerAction").val(bp.localSettings.timerAction).parent().find("label").text(chrome.i18n.getMessage("timerAction"));
    $("#timerAction").find("option").each(function() {
      $(this).text(chrome.i18n.getMessage("timerAction_" + $(this).attr("value")));
    });
    $("#startTimer").text(chrome.i18n.getMessage("startTimer")).click(function() {
      var min = $("#timerMin").val();
      if (min) {
        bp.localSettings.timerMinutes = min;
        bp.localSettings.timerAction = $("#timerAction").val();
        bp.localSettings.timerNotify = $("#timerNotify").prop("checked");
        bp.localSettings.timerPreNotify = $("#timerPreNotify").val();
        bp.startSleepTimer();
        updateTimerStatus();
      }
    });
    $("#stopTimer").text(chrome.i18n.getMessage("stopTimer")).click(function() {
      bp.clearSleepTimer();
      updateTimerStatus();
    });
    updatePreNotifyMax();
    updateTimerStatus();
  }
  
  function initFilter() {
    function updateOptionsMode() {
      $("#settings").removeClass("f-beg f-adv f-exp").addClass("f-" + bp.settings.optionsMode);
    }
    initSelect("optionsMode").change(updateOptionsMode);
    updateOptionsMode();
    
    $("#filter p").text(chrome.i18n.getMessage("filterHint"));
    $("#filter > div > div > input[type='checkbox']").each(function() {
      var id = $(this).attr("id");
      var cb = initCheckbox(id);
      var label = cb.siblings("label[for='" + id + "']");
      function updateFilter() {
        $("#settings").toggleClass(id, !bp.settings[id]);
        label.html(bp.settings[id] ? "<a href='#" + id.replace("filter", "legend") + "'>" + label.text() + "</a>" : label.text());
      }
      cb.click(updateFilter);
      updateFilter();
    });
  }
  
  function initLegends() {
    $("#settings legend").each(function() {
      $(this).text(chrome.i18n.getMessage(this.id));
      appendHint(this).text(chrome.i18n.getMessage(this.id + "Hint")).insertAfter(this);
    });
  }
  
  $(function() {
    $("head > title").text(chrome.i18n.getMessage("options") + " - " + chrome.i18n.getMessage("extTitle"));
    initLegends();
    
    $("#lastfmStatus").find("span").text(chrome.i18n.getMessage("lastfmUser"));
    var bugfeatureinfo = chrome.i18n.getMessage("bugfeatureinfo", "<a target='_blank' href='https://github.com/svenackermann/Prime-Player-Google-Play-Music/issues' data-network='github' data-action='issue'>GitHub</a>");
    $("#bugfeatureinfo").html(bugfeatureinfo);
    
    initTimer();
    
    initCheckbox("scrobble");
    var percentSpan = $("#scrobblePercent").parent().find("span");
    percentSpan.text(bp.settings.scrobblePercent);
    $("#scrobblePercent")
      .val(bp.settings.scrobblePercent)
      .mouseup(numberUpdater("scrobblePercent", bp.settings))
      .change(function(){ percentSpan.text($(this).val()); });
    setLabel("scrobblePercent");
    initNumberInput("scrobbleTime");
    initNumberInput("scrobbleMaxDuration");
    initCheckbox("disableScrobbleOnFf");
    initHint("disableScrobbleOnFf");
    initCheckbox("scrobbleRepeated");
    initCheckbox("linkRatings").click(linkRatingsChanged);
    initHint("linkRatings");
    initCheckbox("linkRatingsGpm");
    initCheckbox("showLovedIndicator");
    initCheckbox("showScrobbledIndicator");
    initCheckbox("showLastfmInfo");
    
    $("#notificationDisabledWarning").text(chrome.i18n.getMessage("notificationsDisabled"));
    initCheckbox("toast").click(toastChanged);
    initHint("toast");
    initCheckbox("toastUseMpStyle").click(toastChanged);
    initHint("toastUseMpStyle");
    initNumberInput("toastDuration");
    initHint("toastDuration");
    initCheckbox("toastProgress");
    initCheckbox("toastIfMpOpen");
    initSelect("toastClick", bp.getTextForToastBtn);
    initSelect("toastButton1")
      .append($("#toastClick").children().clone())
      .val(bp.settings.toastButton1);
    initSelect("toastButton2")
      .append($("#toastClick").children().clone())
      .val(bp.settings.toastButton2);
    
    function setLayoutHintVisibility() {
      var panel = bp.settings.miniplayerType == "panel" || bp.settings.miniplayerType == "detached_panel";
      $("#miniplayerType").siblings(".hint").toggle(panel);
      if (!panel) $("#miniplayerType").siblings(".hint-text").hide();
      var visible = panel && bp.settings.layout == "hbar";
      $("#layout").siblings(".hint").toggle(visible);
      if (!visible) $("#layout").siblings(".hint-text").hide();
    }
    initSelect("miniplayerType").change(setLayoutHintVisibility);
    initHint("miniplayerType").find("a").text("chrome://flags").attr("tabindex", "0").click(function() { chrome.tabs.create({ url: "chrome://flags" }); });
    initSelect("layout").change(setLayoutHintVisibility);
    initHint("layout");
    setLayoutHintVisibility();
    initSelect("color");
    initColorInput("mpBgColor");
    initColorInput("mpTextColor");
    initSelect("coverClickLink", bp.getTextForQuicklink);
    initSelect("titleClickLink")
      .append($("#coverClickLink").children().clone())
      .val(bp.settings.titleClickLink);
    initCheckbox("openLinksInMiniplayer");
    initHint("openLinksInMiniplayer");
    initCheckbox("hideSearchfield");
    initCheckbox("hideRatings");
    initCheckbox("omitUnknownAlbums");
    initHint("omitUnknownAlbums");
    initCheckbox("mpAutoOpen");
    initCheckbox("mpAutoClose");
    initCheckbox("mpCloseGm");
    
    initLyrics();
    initCheckbox("openLyricsInMiniplayer");
    initHint("openLyricsInMiniplayer");
    initCheckbox("lyricsAutoReload");
    initCheckbox("lyricsInGpm").click(lyricsChanged);
    initNumberInput("lyricsFontSize", bp.localSettings);
    initNumberInput("lyricsWidth", bp.localSettings);
    
    $("#shortcutsLink").text(chrome.i18n.getMessage("configShortcuts")).click(function() { chrome.tabs.create({ url: "chrome://extensions/configureCommands" }); });
    initIconStyle();
    initCheckbox("showPlayingIndicator");
    initCheckbox("showRatingIndicator");
    initCheckbox("showProgress").click(showProgressChanged);
    initColorInput("showProgressColor");
    initCheckbox("saveLastPosition");
    initHint("saveLastPosition");
    initSelect("skipRatedLower");
    initSelect("iconClickAction0")
      .append($("#toastClick").children().clone())
      .val(bp.settings.iconClickAction0)
      .change(iconClickChanged);
    initSelect("iconClickAction1")
      .append($("#toastClick").children().clone())
      .val(bp.settings.iconClickAction1)
      .change(iconClickChanged);
    initSelect("iconClickAction2")
      .append($("#toastClick").children().clone())
      .val(bp.settings.iconClickAction2)
      .change(iconClickChanged);
    initSelect("iconClickAction3")
      .append($("#toastClick").children().clone())
      .val(bp.settings.iconClickAction3);
    initNumberInput("iconDoubleClickTime").change(iconClickChanged);
    initHint("iconDoubleClickTime");
    initCheckbox("iconClickConnect");
    initCheckbox("openGoogleMusicPinned");
    initNumberInput("googleAccountNo", bp.localSettings);
    initHint("googleAccountNo");
    initCheckbox("connectedIndicator");
    initCheckbox("preventCommandRatingReset");
    initHint("preventCommandRatingReset");
    initCheckbox("updateNotifier");
    initCheckbox("syncSettings", bp.localSettings);
    initCheckbox("gaEnabled");
    initHint("gaEnabled");
    
    //watch this if changed via miniplayer
    bp.settings.addListener("scrobble", scrobbleChanged, "options");
    //we must watch this as the session could be expired
    bp.localSettings.watch("lastfmSessionName", lastfmUserChanged, "options");
    bp.localSettings.watch("notificationsEnabled", notificationsEnabledChanged, "options");
    //watch for timer status
    bp.player.addListener("connected", updateTimerStatus, "options");
    
    //disable inputs if neccessary
    toastChanged();
    lyricsChanged();
    iconClickChanged();
    showProgressChanged();
    
    $("#resetSettings").click(function() {
      bp.settings.resetToDefaults();
      bp.localSettings.resetToDefaults();
      bp.gaEvent("Options", "reset");
      location.reload();
    }).text(chrome.i18n.getMessage("resetSettings"));
    
    //tell the background page that we're open
    chrome.tabs.getCurrent(function(tab) {
      thisTabId = tab.id;
      if (bp.optionsTabId === null) bp.optionsTabId = tab.id;
    });
    
    //get last.fm session if we are the callback page (query param "token" exists)
    var token;
    if (bp.localSettings.lastfmSessionName === null && (token = bp.extractUrlParam("token", location.search))) {
      getLastfmSession(token);
      history.replaceState("", "", chrome.extension.getURL("options.html"));//remove token from URL
    }
    
    //mark new features
    if (bp.previousVersion) {
      $("div[class*='v-']").each(function() {
        var version = extractVersionFromClass(this);
        if (bp.isNewerVersion(version)) $(this).addClass("newFeature");
      });
      bp.updateInfosViewed();
    }
    
    //set headings in changelog
    $("#changelog > div[class*='v-']").each(function() {
      var version = extractVersionFromClass(this);
      $(this).prepend("<h3>Version " + version + "</h3>");
    });
    
    $("#changelog").on("click", "input[type='checkbox']", function() {
      $("#changelog").toggleClass(this.id.substr(3,1));
    });
    
    $("#credits").on("click", "a[data-network]", function() {
      bp.gaSocial($(this).data("network"), $(this).data("action") || "show");
    });
    
    initFilter();
  });

  $(window).unload(function() {
    bp.settings.removeAllListeners("options");
    bp.localSettings.removeAllListeners("options");
    bp.player.removeAllListeners("options");
    if (bp.optionsTabId == thisTabId) bp.optionsTabId = null;
  });

});
