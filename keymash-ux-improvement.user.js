// ==UserScript==
// @name         Keymash UX Improvement
// @namespace    com.github.ph0t0shop
// @version      0.2.1
// @description  clearer wpm counter for yourself, clearer way to see progress for others
// @author       ph0t0shop
// @match        https://keyma.sh/*
// @grant        none
// ==/UserScript==

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
    div.style.position = "absolute";
    div.setAttribute("id", "wpm-counter-wrapper");
    div.innerHTML = '<span id="wpm-counter">0.00</span><span class="text-orange-400 text-opacity-50 text-lg uppercase">WPM</span>';
    return div;
}

function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
};

function createCaret(userID) {
    const div = document.createElement("div");
    div.setAttribute("id", `caret${userID}`);
    div.setAttribute("style", `width: 2px; height: 23px; margin-left: -2px; margin-top: 4px; transform: scale(1.1); transition: margin ${settings["smooth-carets-others"]}ms ease 0s; background-color: ${settings["caret-color-others"]}`);
    div.className = `absolute rounded other-players-caret`;
    return div;
}

function createProgressBarContainer() {
    const div = document.createElement("div");
    div.id = "custom-progress-bar-container";
    div.className = "custom-progress-bar-container rounded-t flex flex-wrap";
    return div;
}

function createProgressBar(userID, userName) {
    const div = document.createElement("div");
    div.className = "w-full bg-black bg-opacity-40 h-4 mb-1 rounded title-overflow";

    const nameSpan = document.createElement("span");
    nameSpan.className = "pl-1 font-semibold text-gray-200";
    nameSpan.textContent = userName;
    nameSpan.style = "position: absolute; line-height: 1.3em; height: inherit; display: flex; align-items: end; overflow-y: hidden;"
    div.appendChild(nameSpan);

    const innerDiv = document.createElement("div");
    innerDiv.id = `custom-progress-bar${userID}`;
    innerDiv.className = "progress-smooth bg-blue-400 bg-opacity-50 h-4";
    innerDiv.style.width = "0%";
    div.appendChild(innerDiv);

    return div;
}

let matchText;
function getLetterOffset (index) {
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
        }
    }
    if (!res) { // for the last character 
        const letter = matchText.children[2].lastChild;
        if (!letter) {
            return [-100000, -100000];
        }
        res = {
            offsetLeft: letter.offsetLeft + letter.getBoundingClientRect().width,
            offsetTop: letter.offsetTop
        };
    }
    return [res.offsetLeft - 2, res.offsetTop];
}

const showWPM = localStorage.getItem("show-wpm");
const showCarets = localStorage.getItem("show-carets");
const hideOthersProgress = localStorage.getItem("hide-others-progress");
const smoothCaretsOthers = localStorage.getItem("smooth-carets-others");
const bigProgressBar = localStorage.getItem("big-progress-bar");
const caretColorOthers = localStorage.getItem("caret-color-others");
let settings = {
    "show-wpm": showWPM ? showWPM === "yes" : true,
    "show-carets": showCarets ? showCarets === "yes" : true,
    "hide-others-progress": hideOthersProgress ? hideOthersProgress === "yes" : false,
    "smooth-carets-others": smoothCaretsOthers === null ? "0" : smoothCaretsOthers,
    "big-progress-bar": bigProgressBar === null ? 2 : parseInt(bigProgressBar),
    "caret-color-others": caretColorOthers === null ? "#f6ad55" : caretColorOthers
}

function addStyle(css) {
    const style = document.getElementById("GM_addStyleBy8626") || (function() {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.id = "GM_addStyleBy8626";
        document.head.appendChild(style);
        return style;
    })();
    const sheet = style.sheet;
    sheet.insertRule(css, (sheet.rules || sheet.cssRules || []).length);
}

let alertTimeout;
function showSuccessAlert() {
    if (document.querySelector("form > div.fixed")) {
        document.querySelector("form > div.fixed").style.display = "block";
    } else {
        document.querySelector("form").prepend(getSuccessAlert());
    }
    clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => {
        if (document.querySelector("form > div.fixed")) {
            document.querySelector("form > div.fixed").style.display = "none";
        }
    }, 5000);
}


function createSettingsElem (settingTitle, settingName, options, left, loadFunc, saveFunc) { // settingName is string, options is list of {text: , value: } objects. 
    if (!loadFunc) loadFunc = val => val.toString();
    if (!saveFunc) saveFunc = val => val.toString();
    const div = document.createElement("div");
    div.className = `w-full lg:w-1/2 lg:p${left ? "r" : "l"}-2 custom-settings-elem`;
    const titleDiv = document.createElement("div");
    titleDiv.className = "pt-4 pb-1 text-blue-300 text-base uppercase font-semibold tracking-wider";
    titleDiv.innerText = settingTitle;
    div.appendChild(titleDiv);
    const selectElem = document.createElement("select");
    selectElem.className = "form-settings";
    selectElem.setAttribute("name", `usersetting-${settingName}`);

    for (const option of options) {
        const optionElem = document.createElement("option");
        optionElem.setAttribute("value", option.value);
        optionElem.innerText = option.text;
        selectElem.appendChild(optionElem);
    }

    selectElem.addEventListener("change", function() {
        localStorage.setItem(settingName, selectElem.value);
        settings[settingName] = loadFunc(selectElem.value);
        showSuccessAlert();
    });

    selectElem.value = saveFunc(settings[settingName]);

    div.appendChild(selectElem);
    return div;
}

function createBooleanSettingsElem(settingTitle, settingName, left) {
    return createSettingsElem(settingTitle, settingName,
        [
            { value: "yes", text: "Yes" },
            { value: "no", text: "No" }
        ],
        left,
        (val) => val === "yes",
        (val) => val ? "yes" : "no",
    )
}

function onColorClicked() {
    localStorage.setItem("caret-color-others", this.value);
    settings["caret-color-others"] = this.value;
    showSuccessAlert();
}

function createColorPicker() {
    const div = document.createElement("div");
    div.className = "w-full";

    const titleDiv = document.createElement("div");
    titleDiv.className = "pt-4 pb-1 text-blue-300 text-base uppercase font-semibold tracking-wider";
    titleDiv.innerText = "Caret color (others)";
    div.appendChild(titleDiv);

    const containerDiv = document.createElement("div");
    containerDiv.className = "flex flex-wrap";
    for (const colorCode of ["#cbd5e0","#a0aec0","#718096","#4a5568","#2d3748","#1a202c","#fc8181","#f56565","#e53e3e","#c53030","#9b2c2c","#742a2a","#f6ad55","#ed8936","#dd6b20","#c05621","#9c4221","#7b341e","#f6e05e","#ecc94b","#d69e2e","#b7791f","#975a16","#744210","#68d391","#48bb78","#38a169","#2f855a","#276749","#22543d","#4fd1c5","#38b2ac","#319795","#2c7a7b","#285e61","#234e52","#63b3ed","#4299e1","#3182ce","#2b6cb0","#2c5282","#2a4365","#7f9cf5","#667eea","#5a67d8","#4c51bf","#434190","#3c366b","#b794f4","#9f7aea","#805ad5","#6b46c1","#553c9a","#44337a","#f687b3","#ed64a6","#d53f8c","#b83280","#97266d","#702459","#000","#fff"]) {
        const colorDiv = document.createElement("div");
        colorDiv.style = "width:8%; height: 2rem;";
        containerDiv.appendChild(colorDiv);

        const colorLabel = document.createElement("label");
        colorDiv.appendChild(colorLabel);

        const inputElem = document.createElement("input");
        inputElem.setAttribute("type", "radio");
        inputElem.className = "form-control-radio-image caret-color-radio";
        inputElem.setAttribute("name", "caretColor");
        inputElem.setAttribute("value", colorCode);
        inputElem.addEventListener("change", onColorClicked);
        colorLabel.appendChild(inputElem);

        if (colorCode === settings["caret-color-others"]) {
            inputElem.checked = true;
        }

        const bgDiv = document.createElement("div");
        bgDiv.style.cursor = "pointer";
        bgDiv.classList.add("w-full", "h-full");
        bgDiv.style.backgroundColor = colorCode;
        colorLabel.appendChild(bgDiv);
    }
    div.appendChild(containerDiv);
    return div;
}

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

        if (document.querySelector(".custom-settings-elem")) return; // settings are already loaded here
        addSetting(createBooleanSettingsElem("Show large WPM", "show-wpm", left));
        addSetting(createBooleanSettingsElem("Show others' carets", "show-carets", !left));
        addSetting(createBooleanSettingsElem("Hide others' progress", "hide-others-progress", left));
        addSetting(createSettingsElem("Big progress bar", "big-progress-bar", [
            { value: "0", text: "Off" },
            { value: "1", text: "Self" },
            { value: "2", text: "Everyone" }
        ],
        !left,
        parseInt));
        addSetting(createSettingsElem("Smooth carets (others)", "smooth-carets-others", [
            { value: "0", text: "Off" },
            { value: "50", text: "Faster" },
            { value: "75", text: "Fast" },
            { value: "100", text: "Normal" },
            { value: "125", text: "Slow" },
            { value: "150", text: "Slower" }
        ],
        left))
        addSetting(createColorPicker());
    }
}

function getSuccessAlert() {
    let div = document.createElement("div");
    div.setAttribute("class", "z-50 fixed top-0 right-0 left-0 lg:left-auto lg:ml-0 ml-6 mt-6 mr-6");
    div.innerHTML = '<div class="rounded border-l-4 border-green-500 bg-green-900 px-6 py-4 uppercase text-white font-semibold text-sm"><div class="flex"><div class="hidden lg:block lg:w-8 my-auto pt-1"><svg aria-hidden="true" focusable="false" data-prefix="fad" data-icon="check-circle" class="svg-inline--fa fa-check-circle fa-w-16 text-xl" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g class="fa-group"><path class="fa-secondary" fill="currentColor" d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm155.31 195.31l-184 184a16 16 0 0 1-22.62 0l-104-104a16 16 0 0 1 0-22.62l22.62-22.63a16 16 0 0 1 22.63 0L216 308.12l150.06-150.06a16 16 0 0 1 22.63 0l22.62 22.63a16 16 0 0 1 0 22.62z"></path><path class="fa-primary" fill="currentColor" d="M227.31 387.31a16 16 0 0 1-22.62 0l-104-104a16 16 0 0 1 0-22.62l22.62-22.63a16 16 0 0 1 22.63 0L216 308.12l150.06-150.06a16 16 0 0 1 22.63 0l22.62 22.63a16 16 0 0 1 0 22.62l-184 184z"></path></g></svg></div><div class="w-auto my-auto">Your changes have successfully been applied!</div></div></div>';
    return div;
}

(async function() {
    'use strict';

    let users = {};
    let userID = "";
    let userSlug = "";
    let matchWordsLength = 1;

    function socketMessageHandler(data) {
        const json = getJSONFromSocketData(data.data);
        switch (json[0]) {
            case "updateRound": // TODO: set bar progress to 0 here
                let left, top;
                [left, top] = getLetterOffset(0);

                for (const userID in users) {
                    const user = users[userID];
                    if (user.caret) {
                        user.caret.style.marginLeft = `${left}px`;
                        user.caret.style.marginTop = `${top}px`;
                    }
                }
                matchWordsLength = json[1].matchText.split(" ").length;
                break;
            case "getMatch":
                matchWordsLength = json[1].matchText.split(" ").length;
                break;
            case "updatePlayers":
                matchText = document.querySelector(".match--text");
                for (const userID in users) {
                    users[userID].caret?.parentNode?.removeChild(users[userID].caret);
                }
                users = {};
                let progressBarContainer;
                if (settings["big-progress-bar"]) {
                    progressBarContainer = document.querySelector("#custom-progress-bar-container");
                    progressBarContainer.textContent = ""; // clear any previous bars
                }
                for (const user of json[1]) {
                    const userElem = { // populate users object
                        wpm: 0,
                        index: 0,
                        name: user.userName,
                        caret: createCaret(user.userUniqueId)
                    }
                    let left, top;
                    [left, top] = getLetterOffset(0);

                    userElem.caret.style.marginLeft = `${left}px`;
                    userElem.caret.style.marginTop = `${top}px`;
                    users[user.userUniqueId] = userElem;

                    if (settings["show-carets"] && user.userUniqueId !== userID) { // only do this for other users
                        document.getElementById("caret").style.zIndex = "10";
                        document.querySelector(".match--container > :nth-child(1) > :nth-child(1)").children[0].after(userElem.caret);
                    }

                    if (settings["big-progress-bar"] === 2 || (settings["big-progress-bar"] === 1 && user.userUniqueId === userID)) { // either show bars for everyone, or this is ours
                        const progressBar = createProgressBar(user.userUniqueId, user.userName);
                        if (user.userUniqueId === userID) { // this is us
                            progressBarContainer.prepend(progressBar);
                        } else {
                            progressBarContainer.appendChild(progressBar);
                        }
                    }
                }
                if (settings["hide-others-progress"]) { // hide the others
                    for (const elem of document.querySelectorAll(".sidebar-user")) {
                        if (elem.querySelectorAll("a")[0].getAttribute("href") !== `/profile/${userSlug}`) {
                            elem.children[1].style.display = "none";
                        }
                    }
                    const otherRankedPlayer = document.querySelector("div.flex.flex-wrap.px-4.py-2.rounded-bl.flex-row-reverse");
                    if (otherRankedPlayer) {
                        const wpmAndWord = otherRankedPlayer.querySelector("div.w-32.my-auto");
                        if (wpmAndWord) {
                            wpmAndWord.style.display = "none";
                        }
                        const progressBar = otherRankedPlayer.querySelector("div.mt-1.w-full.bg-black.bg-opacity-40.rounded-full");
                        if (progressBar) {
                            progressBar.style.display = "none"
                        }
                    }
                }
                break;
            case "updateWPM":
                if (settings["show-wpm"] && json[1].WPM && json[1].userUniqueId === userID) { // we received our own wpm
                    const wpmElem = document.querySelector("#wpm-counter");
                    wpmElem.innerText = json[1].WPM;
                } else if (settings["show-carets"] && json[1].correctKeystrokes && json[1].userUniqueId !== userID) { // we received another user's keystroke
                    let left, top;
                    [left, top] = getLetterOffset(json[1].correctKeystrokes);

                    users[json[1].userUniqueId].caret.style.marginLeft = `${left}px`;
                    users[json[1].userUniqueId].caret.style.marginTop = `${top}px`;
                } else if (json[1].Placement) { // placement
                    if (settings["show-carets"] && json[1].Placement === 999) { // user left
                        users[json[1].userUniqueId].caret.style.backgroundColor = "#ef4444"; // red
                    }

                    if (settings["big-progress-bar"]) { // user is finished or left
                        const progressBar = document.querySelector(`#custom-progress-bar${json[1].userUniqueId}`);
                        progressBar.classList.remove("bg-blue-400");
                        progressBar.classList.remove("bg-green-400");
                        progressBar.classList.remove("bg-red-600");
                        progressBar.classList.add(json[1].Placement === 999 ? "bg-red-600" : "bg-green-400")
                    }
                }
                if (json[1].Words && settings["big-progress-bar"]) { // user has typed a new word
                    if (settings["big-progress-bar"] === 2 || json[1].userUniqueId === userID) {
                        const progressBar = document.querySelector(`#custom-progress-bar${json[1].userUniqueId}`);
                        progressBar.style.width = `${(json[1].Words / matchWordsLength) * 100}%`;
                    }
                }
                break;
            case "endMatch":
                if (settings["hide-others-progress"]) {
                    for (const elem of document.querySelectorAll(".sidebar-user")) { // make other users' progress reappear
                        if (elem.querySelectorAll("a")[0].getAttribute("href") !== `/profile/${userSlug}`) {
                            elem.children[1].style.display = "inline";
                        }
                    }
                    const otherRankedPlayer = document.querySelector("div.flex.flex-wrap.px-4.py-2.rounded-bl.flex-row-reverse");
                    if (otherRankedPlayer) {
                        const wpmAndWord = otherRankedPlayer.querySelector("div.w-32.my-auto");
                        if (wpmAndWord) {
                            wpmAndWord.style.display = "block";
                        }
                        const progressBar = otherRankedPlayer.querySelector("div.mt-1.w-full.bg-black.bg-opacity-40.rounded-full");
                        if (progressBar) {
                            progressBar.style.display = "block"
                        }
                    }
                }
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
                    const res = value(data);
                    socketMessageHandler(data);
                    return res;
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

    prependToFunc(WebSocket.prototype, 'send', function(data) {
        const json = getJSONFromSocketData(data);

        if (json[0] === "joinMatch") { // join match, also contains user token
            users = {}; // reset all users
            const jwt = json[1].userToken;
            const jwtPayload = parseJwt(jwt);
            userID = jwtPayload.userData.userUniqueId;
            userSlug = jwtPayload.userData.userName + "-" + jwtPayload.userData.userEnum;
            const infoBar = document.querySelector(".game--content--bar");
            if (settings["show-wpm"]) {
                infoBar.style = "display:flex;justify-content:center;align-items:center;";
                infoBar.children[0].after(getWPMElem());
            }
            if (settings["big-progress-bar"]) {
                infoBar.before(createProgressBarContainer());
            }
        }
    });

    prependToFunc(window.history, 'pushState', function(_1, _2, newurl) {
        handleUrl(newurl);
    });

    prependToFunc(window.history, 'replaceState', function(_1, _2, newurl) {
        handleUrl(newurl);
    });

    addStyle(".caret-color-radio:checked + div { border: 1px solid #f6ad55; }");
    addStyle(".custom-progress-bar-container { --tw-bg-opacity: 1; background-color: rgba(30,30,33,var(--tw-bg-opacity)); padding: .75rem; --tw-shadow: 0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06); }");

    handleUrl(window.location);
})();