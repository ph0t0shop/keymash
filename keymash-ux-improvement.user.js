// ==UserScript==
// @name         Keymash UX Improvement
// @namespace    http://tampermonkey.net/
// @version      0.1
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

(function() {
    'use strict';

    let users;
    let userID;
    
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
                            if (json[1].WPM) { // sometimes it's just the keystroke
                                if (json[1].userUniqueId === userID) { // this is us
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
                                    // console.log("MY WPM: " + json[1].WPM);
                                } /* else {
                                    console.log(`${users[json[1].userUniqueId].name}'s WPM: ${json[1].WPM}`)
                                }*/
                            } else if (json[1].correctKeystrokes) {
                                if (json[1].userUniqueId === userID) { // this is us
                                    // console.log(`We got ${json[1].correctKeystrokes} correct keystrokes!`);
                                } else {
                                    // console.log(`${users[json[1].userUniqueId].name} got ${json[1].correctKeystrokes} correct keystrokes!`);

                                    let left, top;
                                    [left, top] = getLetterElem(json[1].correctKeystrokes);
                                    // console.log(users[json[1].userUniqueId]);
                                    // console.log(`SETTING ${left}, ${top}`)
                                    users[json[1].userUniqueId].caret.style.marginLeft = `${left}px`;
                                    users[json[1].userUniqueId].caret.style.marginTop = `${top}px`;
                                }
                            } else if (json[1].Placement) {
                                if (json[1].Placement === 999) { // user left
                                    users[json[1].userUniqueId].caret.classList.remove("bg-orange-400");
                                    users[json[1].userUniqueId].caret.classList.add("bg-red-600");
                                }
                            }
                            break;
                        default:
                            break;
                    }
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

    prependToFunc(WebSocket.prototype, 'send', function(data, force) {
        const json = getJSONFromSocketData(data);

        if (json[0] === "joinMatch") { // join match, also contains user token
            users = {}; // reset all users
            const jwt = json[1].userToken;
            const jwtPayload = parseJwt(jwt);
            userID = jwtPayload.userData.userUniqueId;
            const infoBar = document.querySelector(".game--content--bar");
            if (infoBar) {
                let wpmWrapperElem = document.querySelector("#wpm-counter-wrapper");
                if (!wpmWrapperElem) {
                    wpmWrapperElem = getWPMElem();
                    infoBar.children[0].after(wpmWrapperElem);
                }
            }
        }
    });
})();