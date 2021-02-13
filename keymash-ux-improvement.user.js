// ==UserScript==
// @name         Keymash UX Improvement
// @namespace    com.github.ph0t0shop
// @version      0.1.0
// @description  clearer wpm counter for yourself, clearer way to see progress for others
// @author       ph0t0shop
// @match        https://keyma.sh/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==


// ================ UTILITY FUNCTIONS ================
String.prototype.substringAfterNth = function (needle, n) {
    let counter = 0;
    let index = 0;
    for (let i = 0; i < this.length; i++) {
        if (this[i] === needle) {
            counter++;
            if (counter === n) {
                index = i + 1;
                break;
            }
        }
    }
    return this.substring(index);
}

function sleep(x) { // Wait for x ms
    return new Promise(resolve => setTimeout(resolve, x));
}

async function waitFor(awaitable, interval = 50) {
    let result = awaitable();

    while (!result) {
        await sleep(interval);
        result = awaitable();
    }

    return result;
}

function replaceFunc(obj, funcName, addedFunc) {
	obj[funcName] = function(...args) {
		return addedFunc.apply(this, args);
	}
}

function prependToFunc(obj, funcName, addedFunc) {
    let origFunc = obj[funcName];
	obj[funcName] = function(...args) {
	    if (addedFunc.apply(this, args) === false) return;
		return origFunc.apply(this, args);
	}
}

function getJSONFromSocketData(data) {
    let json = data.substringAfterNth(",", 1);
    try {
        json = JSON.parse(json);
    } catch (_exception) {
        json = {};
    }
    return json;
}

function getWPMElem() {
    let div = document.createElement("div");
    div.setAttribute("class", "text-orange-400 uppercase font-semibold text-4xl");
    div.setAttribute("style",  "margin-top: -10px; position:absolute; left: 50%; transform: translateX(-50%);")
    div.setAttribute("id", "wpm-counter-wrapper");
    div.innerHTML = '<span id="wpm-counter">0.00</span><span class="text-orange-400 text-opacity-50 text-lg uppercase">WPM</span>';
    return div;
}

function getSuccessAlert() {
    let div = document.createElement("div");
    div.setAttribute("class", "z-50 fixed top-0 right-0 left-0 lg:left-auto lg:ml-0 ml-6 mt-6 mr-6");
    div.innerHTML = '<div class="rounded border-l-4 border-green-500 bg-green-900 px-6 py-4 uppercase text-white font-semibold text-sm"><div class="flex"><div class="hidden lg:block lg:w-8 my-auto pt-1"><svg aria-hidden="true" focusable="false" data-prefix="fad" data-icon="check-circle" class="svg-inline--fa fa-check-circle fa-w-16 text-xl" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g class="fa-group"><path class="fa-secondary" fill="currentColor" d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm155.31 195.31l-184 184a16 16 0 0 1-22.62 0l-104-104a16 16 0 0 1 0-22.62l22.62-22.63a16 16 0 0 1 22.63 0L216 308.12l150.06-150.06a16 16 0 0 1 22.63 0l22.62 22.63a16 16 0 0 1 0 22.62z"></path><path class="fa-primary" fill="currentColor" d="M227.31 387.31a16 16 0 0 1-22.62 0l-104-104a16 16 0 0 1 0-22.62l22.62-22.63a16 16 0 0 1 22.63 0L216 308.12l150.06-150.06a16 16 0 0 1 22.63 0l22.62 22.63a16 16 0 0 1 0 22.62l-184 184z"></path></g></svg></div><div class="w-auto my-auto">Your changes have successfully been applied!</div></div></div>';
    return div;
}

function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
};

function createCaret (userID) {
    let div = document.createElement("div");
    div.setAttribute("id", `caret${userID}`);
    div.setAttribute("style", "width: 2px; height: 23px; margin-left: -2px; margin-top: 4px; transform: scale(1.1);");
    div.setAttribute("class", "caret-idle absolute rounded bg-orange-400 other-players-caret");
    return div;
}

let matchText;
let matchTextBoundingRect;
function getLetterElem (index) {
    const first = matchText.children[0];
    let res;
    if (index < first.childElementCount) {
        res = first.children[index];
    } else {
        index -= first.childElementCount;
        if (index == 0) {
            res = matchText.children[1].children[0];
        } else {
            index -= 1;
            res = matchText.children[2].children[index];
            if (res == null) { // for the last character 
                const letter = matchText.children[2].children[matchText.children[2].childElementCount - 1];
                res = {
                    offsetLeft: letter.offsetLeft + letter.getBoundingClientRect().width,
                    offsetTop: letter.offsetTop
                };
            }
        }
    }
    return [res.offsetLeft - 2, res.offsetTop];
}

let settings;

async function loadSettings() {
    const showWPM = await GM_getValue("show-wpm");
    const showCarets = await GM_getValue("show-wpm");
    const hideOthersProgress = await GM_getValue("hide-others-progress");
    settings = {
        "show-wpm": showWPM ? showWPM === "yes" : true,
        "show-carets": showCarets ? showCarets === "yes" : true,
        "hide-others-progress": hideOthersProgress ? hideOthersProgress === "yes" : false
    }
}

let alertTimeout;
async function createSettingsElem (settingTitle, settingName, left) { // very hacky. Do not call with user input. settingName is string, options is list of {text: , value: } objects
    const div = document.createElement("div");
    div.className = `w-full lg:w-1/2 lg:p${left ? "r" : "l"}-2`;
    const titleDiv = document.createElement("div");
    titleDiv.className = "pt-4 pb-1 text-blue-300 text-base uppercase font-semibold tracking-wider";
    titleDiv.innerText = settingTitle;
    div.appendChild(titleDiv);
    const selectElem = document.createElement("select");
    selectElem.className = "form-settings";
    selectElem.setAttribute("name", "userCardBorder");

    const yesOptionElem = document.createElement("option");
    yesOptionElem.setAttribute("value", "yes");
    yesOptionElem.innerText = "Yes";
    selectElem.appendChild(yesOptionElem);

    const noOptionElem = document.createElement("option");
    noOptionElem.setAttribute("value", "no");
    noOptionElem.innerText = "No";
    selectElem.appendChild(noOptionElem);

    selectElem.addEventListener("change", async function() {
        await GM_setValue(settingName, selectElem.value);
        settings[settingName] = selectElem.value === "yes";
        if (document.querySelector("form > div.fixed")) {
            document.querySelector("form > div.fixed").style.display = "block";
        } else {
            document.querySelector("form").prepend(getSuccessAlert());
        }
        clearTimeout(alertTimeout);
        alertTimeout = setTimeout(() => {
            document.querySelector("form > div.fixed").style.display = "none";
        }, 5000);
    });

    selectElem.value = settings[settingName] ? "yes" : "no";

    div.appendChild(selectElem);
    return div;
}

// =================== MAIN PART OF SCRIPT =================

(function() {
    'use strict';

    async function handleUrl(url) {
        url = url.toString(); // window.location is a URI object or smth
        if (url.startsWith("https://keyma.sh")) url = url.substring("https://keyma.sh".length)
        if (url === "/settings") {
            let personalizeH2 = await waitFor(() => document.querySelectorAll("form h2")[3]);
            let settingsDiv = await waitFor(() => personalizeH2.nextSibling.querySelector("div > div.flex.flex-wrap.p-2"));
            function addSetting(elem) {
                settingsDiv.lastChild.before(elem);
            }

            const left = settingsDiv.getElementsByClassName("lg:w-1/2").length % 2 == 0;

            addSetting(await createSettingsElem("Show WPM", "show-wpm", left, ["Yes", "No"]));
            addSetting(await createSettingsElem("Show carets", "show-carets", !left, ["Yes", "No"]));
            addSetting(await createSettingsElem("Hide others' progress", "hide-others-progress", left, ["Yes", "No"]));
        }
    }

    let users;
    let userID;

    function socketMessageHandler(data) {
        const json = getJSONFromSocketData(data.data);
        switch (json[0]) {
            case "updatePlayers":
                matchText = document.querySelector(".match--text");
                matchTextBoundingRect = matchText.getBoundingClientRect();
                for (const userID in users) {
                    users[userID].caret?.parentNode?.removeChild(users[userID].caret);
                }
                users = {};
                for (const user of json[1]) {
                    const userElem = { // populate users object
                        wpm: 0,
                        index: 0,
                        name: user.userName,
                        caret: createCaret(user.userUniqueId)
                    }
                    let left, top;
                    [left, top] = getLetterElem(0);
                    // console.log(users[json[1].userUniqueId]);
                    // console.log(`SETTING ${left}, ${top}`)
                    userElem.caret.style.marginLeft = `${left}px`;
                    userElem.caret.style.marginTop = `${top}px`;
                    users[user.userUniqueId] = userElem;
                    // console.log("ADDED " + users[user.userUniqueId].name);
                    if (user.userUniqueId !== userID) { // only do this for other users
                        document.querySelector(".match--container > :nth-child(1) > :nth-child(1)").children[0].after(userElem.caret);
                    }
                }
                break;
            case "updateWPM":
                if (settings["show-wpm"] && json[1].WPM && json[1].userUniqueId === userID) { // we received our own WPM
                    const infoBar = document.querySelector(".game--content--bar");
                    if (infoBar) {
                        let wpmWrapperElem = document.querySelector("#wpm-counter-wrapper");
                        if (!wpmWrapperElem) {
                            wpmWrapperElem = getWPMElem();
                            infoBar.appendChild(wpmWrapperElem);
                        }
                        const wpmElem = wpmWrapperElem.querySelector("#wpm-counter");
                        wpmElem.innerText = json[1].WPM;
                    }
                } else if (settings["show-carets"] && json[1].correctKeystrokes && json[1].userUniqueId !== userID) { // we received another user's keystroke
                    let left, top;
                    [left, top] = getLetterElem(json[1].correctKeystrokes);

                    users[json[1].userUniqueId].caret.style.marginLeft = `${left}px`;
                    users[json[1].userUniqueId].caret.style.marginTop = `${top}px`;
                } else if (settings["show-carets"] && json[1].Placement && json[1].Placement === 999) { // a user left
                    users[json[1].userUniqueId].caret.classList.remove("bg-orange-400");
                    users[json[1].userUniqueId].caret.classList.add("bg-red-600");
                }
                break;
            default:
                break;
        }
    }
    
    const instanceHandler = {
        get(target, name) {
            let ret = Reflect.get(target, name);
            if (typeof ret === "function") {
              ret = ret.bind(target);
            }
            return ret;
        },
        set(target, name, value) {
            if (name == "onmessage") {
                return Reflect.set(target, name, function(data) {
                    socketMessageHandler(data);
                    return value(data);
                });
            }
            return Reflect.set(target, name, value);
        }
    };

    const handler = {
        construct(target, args) {
            return new Proxy(new target(...args), instanceHandler);
        }
    }

    WebSocket = new Proxy(WebSocket, handler);

    loadSettings();

    prependToFunc(WebSocket.prototype, 'send', function(data) {
        const json = getJSONFromSocketData(data);

        if (json[0] === "joinMatch") { // join match, also contains user token
            users = {}; // reset all users
            const jwt = json[1].userToken;
            const jwtPayload = parseJwt(jwt);
            userID = jwtPayload.userData.userUniqueId;
            const infoBar = document.querySelector(".game--content--bar");
            if (infoBar && settings["show-wpm"]) {
                let wpmWrapperElem = document.querySelector("#wpm-counter-wrapper");
                if (!wpmWrapperElem) {
                    wpmWrapperElem = getWPMElem();
                    infoBar.children[0].after(wpmWrapperElem);
                }
            }
        }
    });

    prependToFunc(window.history, 'pushState', function(_1, _2, newurl) {
        handleUrl(newurl);
    });

    prependToFunc(window.history, 'replaceState', function(_1, _2, newurl) {
        handleUrl(newurl);
    });

    handleUrl(window.location);

    setInterval(() => {
        console.log(JSON.stringify(settings));
    }, 1000)
})();