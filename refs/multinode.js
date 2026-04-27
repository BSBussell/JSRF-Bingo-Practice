const { json } = require('body-parser');
const WebSocket = require('ws');
const axios = require('axios');
const wss = new WebSocket.Server({ port: 6969 });

const Peer = require('peerjs-on-node').Peer;
const fs = require("node:fs");
const { message } = require('git-rev-sync');


// TODO: The name section of this may become automated or passed via argument.
const ID1 = ["69ef2953-303f-4096-a867-96b3b94c8925", "7thAce"];
const ID2 = ["f4228f57-2905-42a7-a917-d241e1787d24", null];
const WS_SOURCE = "Multinode";

// const args = process.argv.slice(2)
// console.log(args);

const LEVELS = Object.freeze({
    GARAGE: "Garage",
    DOGEN: "Dogen",
    SHIBUYA: "Shibuya",
	CHUO: "Chuo",
	HIKAGE: "Hikage",
	x99TH: "99th",
	SKYSCRAPER: "SDPP",
	STADIUM: "Stadium",
	HWY0: "HWY0",
	SKYDINO: "Sky Dino",
	RDH: "RDH",
	SEWERS: "Sewers",
	BOTTOMPOINT: "Btm pt.",
	KIBO: "Kibo",
	FRZ: "FRZ"
});

let teams = [];
let clients = [];

console.log("-- NodeCG version boot.");

// Connection to the kevingo server.


function launchAutomarker(leftID, rightID) {
	console.log(`Received request to launch automarker... with IDs ${leftID} and ${rightID}`);

	kevingoSocket = new WebSocket("wss://chat.kevcyg.net");
	nodecgServer = new WebSocket('ws://localhost:7135');

	kevingoSocket.onopen = () => {
		console.log("Connected to Kevingo!");
		kevingoSocket.send(JSON.stringify({ username : "automarker" }));
	};

	kevingoSocket.onclose = (event) => console.log("Disconnected from WebSocket server", event);
	kevingoSocket.onerror = (error) => console.error("WebSocket error:", error);

	nodecgServer.onopen = () => {
		SendToNodeCG("connect", "Connected");
	}
	const peer = new Peer(null, {});

	peer.on("open", () => {
		console.log(`Attempting connection to ${leftID}...`);
		let conn1 = peer.connect(leftID); // ID1[0] is the surge code which we're going to use to identify everything so index has it.
		let leftTeam = new Team(conn1, leftID);
		teams.push(leftTeam);
		
		//conn1.send(JSON.stringify({"cat":0,"sub":4,"b":0,"dw1":1097364535,"dw2":25955,"dw3":0}));
		//ParseGameData(JSON.parse("{ cat: 2, sub: 0, b: 0, dw1: 131072, dw2: 45, dw3: -229377 }", conn1));

		conn1.on("data", (data) => {
			ParseGameData(JSON.parse(data), leftTeam);
			//conn.send({"cat":0,"sub":4,"b":0,"dw1":1097364535,"dw2":25955,"dw3":0});
		});
		
		
		if (rightID != null && rightID.length > 0) {
			let conn2 = peer.connect(rightID);
			let rightTeam = new Team(conn2, rightID);
			teams.push(rightTeam);
			conn2.on("data", (data) => {
				ParseGameData(JSON.parse(data), rightTeam);
				//console.log(rightTeam);
				//conn.send({"cat":0,"sub":4,"b":0,"dw1":1097364535,"dw2":25955,"dw3":0});
			});
		} else {
			console.log("No right team ID provided; skipping connection.");
		}
	});
}

// I THINK THIS IS ALL WE HAVE TO UPDATE
// SEND IT TO THE NEW SERVER VIA NODECG AND STORE INFO THERE
// JUST GOTTA FIGURE OUT WHAT TO STORE

class BingoEvent {
	type = ""; // SOUL, CHARACTER, GRAFFITI
	playerName = "";
	id = -1;
	time = -1;

	constructor(_type, _playerName, _id) {
		this.type = _type;
		this.playerName = _playerName;
		this.id = _id;
		this.time = new Date().valueOf(); // Epoch milliseconds
	}

	toAutomarker() {
        return {
            type: "automark",
            data: {
                type: this.type,
                playerName: this.playerName,
                id: this.id,
                time: this.time
            }
        }
    }
}

class Team {
	conn = null;
	surgeID = "";
	graffiti = InitTagData();
	players = [];
	tapes = [];

	constructor(_connection, _surgeID) {
		this.conn = _connection;
		this.surgeID = _surgeID;
		this.graffiti = InitTagData();
		this.players = [];
	}

	OutputGraffiti() {
		let grafOutput = {};
		for (const [name, value] of Object.entries(this.graffiti)) {
			if (value != null) {
				grafOutput[value.name] = value.OutputGraffitiInfo()
			}
		}
		let returnDict = {}
		returnDict[this.name] = grafOutput;
		returnDict["teamID"] = this.surgeID;
		return returnDict;
	}

	//Does not output incomplete graffiti list
	OutputAbbreviatedGraffiti() {
		let grafOutput = {}
		for (const [name, value] of Object.entries(this.graffiti)) {
			if (value != null) {
				grafOutput[value.name] = value.OutputAbbreviatedGraffitiInfo()
			}
		}
		let returnDict = {}
		returnDict[this.name] = grafOutput;
		returnDict["teamID"] = this.surgeID;
		return returnDict;
	}

	OutputPlayerLocations() {
		let playerOutput = {};
		this.players.forEach(player => {
			if (player.name.length > 0) {
				playerOutput[player.name] = GetLevelFromID(player.location);
			}
		})
		playerOutput["teamID"] = this.surgeID;
		return playerOutput;
	}

	OutputTeamTapes() {
		let tapeOutput = {};
		tapeOutput[this.name] = this.tapes;
		tapeOutput["teamID"] = this.surgeID;
		return tapeOutput;
	}
}

class Player {
	name = null;
	location = null;
	automarkStatus = false;
	enterTimestamp = -1;

	constructor(_name) {
		this.name = _name;
		this.location = "Unknown"
		this.automarkStatus = false;
		this.enterTimestamp = -1;
	}
}

class Level {
	incompleteGraffiti = [];
	completeGraffiti = [];
	maxGraffiti = 0;
	id = -1;
	name = "";
	tape = false;

	constructor(id, graffitiList) {
		this.incompleteGraffiti = [];
		this.id = id;
		this.name = GetLevelFromID(id);

		graffitiList.forEach(graffitiInfo => {
			this.incompleteGraffiti.push(new Graffiti(graffitiInfo));
		});
		this.maxGraffiti = this.incompleteGraffiti.length;
	}

	CountGraffiti() {
		return this.completeGraffiti.length;
	}

	GetGraffitiByID(graffitiID) {
		let returnObj = null;
		this.incompleteGraffiti.forEach(graffitiObj => {
			if (graffitiObj.id == graffitiID) {
				returnObj = graffitiObj;
			}
		});
		this.completeGraffiti.forEach(graffitiObj => {
			if (graffitiObj.id == graffitiID) {
				returnObj = graffitiObj;
			}
		});
		return returnObj;
	}

	MarkGraffitiAsComplete(graffitiObj) {
		let targetIndex = this.incompleteGraffiti.indexOf(graffitiObj)
		this.completeGraffiti.push(this.incompleteGraffiti.splice(targetIndex, 1));
		if (this.incompleteGraffiti.length == 0) {
			return true;
		} 
		return false;
	}

	OutputGraffitiInfo() {
		return {"name": this.name, "complete": this.CountGraffiti(), "maximum": this.maxGraffiti, "incompleteList": this.incompleteGraffiti};
	}

	OutputAbbreviatedGraffitiInfo() {
		return {"name": this.name, "complete": this.CountGraffiti(), "maximum": this.maxGraffiti};
	}
}

class Graffiti {
	constructor(infoArray) {
		this.id = infoArray[0];
		this.size = infoArray[1];
		this.location = infoArray[2];
		this.completeTags = [];
		switch (this.size) {
			case "S":
				this.incompleteTags = [-8];
				break;
			case "SS":
				this.incompleteTags = [-8];
				break;
			case "M":
				this.incompleteTags = [-8, -57, -449];
				break;
			case "L":
				this.incompleteTags = [-8, -57, -449, -3585, -28673, -229377];
				break;
			case "XL":
				this.incompleteTags = [-8, -57, -449, -3585, -28673, -229377, -1835009, -14680065, -117440513, -939524097]; // * 1.1
				break;
			default:
				this.incompleteTags = [];
				break;
			
		}
		// console.log(`Size: ${this.size} / This tag has completed ${this.completeTags} and has incomplete ${this.incompleteTags}`);
	}

	MarkTagAsComplete(tagID) {
		if (this.completeTags.includes(tagID)) {
			console.log(`Already have ${tagID} for ${this.location} (ID: ${this.id})`);
		} else {
			this.completeTags.push(this.incompleteTags.splice(this.incompleteTags.indexOf(tagID), 1));
			// console.log(`Marked ${tagID} for ${this.location} (ID: ${this.id})`);
			if (this.incompleteTags.length == 0) {
				console.log(`[${GetNow()}] ${this.location} graffiti is complete!`);
				return true;
			}
		}
		return false;
	}
}




/*peer.on("connection", (dc) => {
	connections.push(new PlayerConnection(dc));
	console.log("added new player");
})*/
function HandlePlayerRegister(playerName, playerIndex, teamObj) {
	if (playerIndex < teamObj.players.length) {
		if (teamObj.players[playerIndex] == null) {
			teamObj.players[playerIndex] = new Player(playerName);
			console.log(`Added EXISTING player ${playerName} to team ${teamObj.name} at index ${playerIndex}`);
		} else {
			teamObj.players[playerIndex].name = playerName
			console.log(`Changed name for player ${playerIndex} to ${playerName} on team ${teamObj.name}`);
		}
	} else {
		teamObj.players.push(new Player(playerName));
		console.log(`Added NEW player ${playerName} to team ${teamObj.name} at index ${playerIndex}`);
	}
	
	const players = teams.map(team => team.players).flat();
	const playerNames = players.filter(player => player.name !== "").map(player => player.name);
	if (kevingoSocket && playerName != '') {
		kevingoSocket.send(JSON.stringify({type : "set_automark", data : {names : playerNames}}));
	}
}

/** 
 * ParseGameData and Handler conventions:
 * ParseGameData should only log to console and call Handler functions.
 * Handler functions should never accept all of jsonData as an argument.
 * Handlers should name the parts of jsonData that they need in the arguments.
 */

function ParseGameData(jsonData, teamObj) {
    const prefix = `Received Data - cat: ${jsonData.cat}, sub: ${jsonData.sub}, b: ${jsonData.b}, dw1: ${jsonData.dw1}, dw2: ${jsonData.dw2}, dw3: ${jsonData.dw3} -> `;

    switch (jsonData.cat) {
        case 0:
			console.log(prefix);
            switch (jsonData.sub) {
                case 0:
                    console.log(`Connected`);
                    break;
                case 1:
                    console.log(`Ping received`);
                    break;
                case 2:
                    console.log(`Player count: ${jsonData.b}`);
					teamObj.players.length = jsonData.b;
                    break;
                case 3:
                    console.log(`Set player index: ${jsonData.b}`);
                    break;
                case 4:
					HandlePlayerRegister(dwsToString(jsonData.dw1, jsonData.dw2, jsonData.dw3), jsonData.b, teamObj) 
                    break;
                case 5:
                    console.log(`Tickrate set to: ${jsonData.dw1}`);
                    break;
                case 6:
                    console.log(`Kill combo activated`);
                    HandleKillCombo(teamObj);
                    break;
                case 7:
                    console.log(`Load mission - Chapter: ${jsonData.dw1}, Mission: ${jsonData.dw2}, Entrance: ${jsonData.dw3}`);
                    break;
                case 8:
                    console.log(`Recording state: ${jsonData.b}`);
                    break;
            }
            break;
        case 1:
            switch (jsonData.sub) {
                case 0:
                    console.log(`Health restored: ${jsonData.dw1}`);
                    break;
                case 1:
                    console.log(`Cans collected: ${jsonData.dw1}`);
                    break;
            }
            break;
        case 2:
			// console.log(prefix);
            switch (jsonData.sub) {
                case 0:
                    // console.log(`Tag sprayed - Area: ${jsonData.dw1}, Spray: ${jsonData.dw2}, Value: ${jsonData.dw3}`);
                    HandleTagSprayed(jsonData.dw1, jsonData.dw2, jsonData.dw3, jsonData.src, teamObj); // jsonData.b is player index, but I don't know if we need that. Maybe we do.
                    break;
				case 1:
					HandleSoulCollect(jsonData.dw1 + 1, jsonData.src, teamObj);
					break;
                case 2:
                    console.log(`Tape collected: ${jsonData.dw1}`);
                    HandleTapeCollect(jsonData.dw1, teamObj);
                    break;
                case 3:
                    console.log(`Soul unlocked: ${jsonData.dw1 + 1}, Area: ${jsonData.dw2}, Index: ${jsonData.dw3}`);
                    HandleSoulUnlock(jsonData.dw1 + 1, teamObj);
                    break;
                case 4:
                    console.log(`Character unlocked: ${jsonData.dw1}`);
                    HandleCharUnlock(jsonData.dw1, jsonData.src, teamObj);
                    break;
                case 5:
                    // console.log(`Progress flag changed: ${jsonData.dw1}`);
                    break;
                case 6:
                    // console.log(`Sprays reset - Area: ${jsonData.dw1}, Start: ${jsonData.dw2}, End: ${jsonData.dw3}`);
                    break;
            }
            break;
        case 3:
            switch (jsonData.sub) {
                case 0:
					HandleAreaChange(jsonData.dw1, jsonData.src, teamObj);
                    break;
                case 1:
                    //console.log(`Movement coords - Index: ${jsonData.b}, X: ${jsonData.dw1}, Y: ${jsonData.dw2}, Z: ${jsonData.dw3}`);
                    break;
                case 2:
                    //console.log(`Movement move - Index: ${jsonData.b}, Rotation: ${jsonData.dw1}, Speed: ${jsonData.dw2}, VSpeed: ${jsonData.dw3}`);
                    break;
                case 3:
                    //console.log(`Ground coords - Index: ${jsonData.b}, X: ${jsonData.dw1}, Y: ${jsonData.dw2}, Z: ${jsonData.dw3}`);
                    break;
                case 4:
                    //console.log(`Air coords - Index: ${jsonData.b}, X: ${jsonData.dw1}, Y: ${jsonData.dw2}, Z: ${jsonData.dw3}`);
                    break;
                case 5:
                    //console.log(`Grind coords - Index: ${jsonData.b}, X: ${jsonData.dw1}, Y: ${jsonData.dw2}, Z: ${jsonData.dw3}`);
                    break;
            }
            break;
    }
}

// Important vocabulary: A "tag" is one part of a "graffiti". There are 6 "tags" in a Large "graffiti".

function HandleTagSprayed(levelID, graffitiID, tagID, playerIndex, teamObj) {
	let levelObj = teamObj.graffiti[GetLevelFromID(levelID)];
	if (levelObj == null) {
		console.log("Stadium/Garage sprays are ignored.");1
		return;
	}

	graffitiObj = levelObj.GetGraffitiByID(graffitiID);
	if (graffitiObj == null) {
		console.log(`Could not find a graffiti in ${levelObj.name} with ID ${graffitiID}. Incomplete:`);
		console.log(levelObj.incompleteGraffiti);
		return;	
	}
	
	let isTagComplete = graffitiObj.MarkTagAsComplete(tagID);
	if (isTagComplete) {
		if (levelObj.MarkGraffitiAsComplete(graffitiObj)) {
			// Level Complete
			HandleGraffitiCompletion(levelObj, playerIndex, teamObj);
			kevingoSocket.send(JSON.stringify((new BingoEvent("Graf", teamObj.players[playerIndex].name, levelObj.name)).toAutomarker()))
		} else {
			// Level incomplete, but tag is complete
			console.log(`${teamObj.name}: Currently at ${levelObj.CountGraffiti()} / ${levelObj.maxGraffiti} in ${levelObj.name}.`);
		}
		SendToNodeCG("graffiti_sprayed", teamObj.OutputAbbreviatedGraffiti());
	}
	return;
}

function HandleGraffitiCompletion(levelObj, playerIndex, teamObj) {
	console.log(`[${GetNow()}] Completed all graffiti for ${levelObj.name}`);
	kevingoSocket.send(JSON.stringify(new BingoEvent("Graffiti", teamObj.players[playerIndex].name, levelObj.name)))
}

function HandleSoulCollect(soulID, playerIndex, teamObj) {
	console.log(`[${GetNow()}] Player ${teamObj.players[playerIndex].name} picked up soul number ${soulID} (${GetSoulInfoFromNumber(soulID)["name"]})`);
	kevingoSocket.send(JSON.stringify((new BingoEvent("Soul", teamObj.players[playerIndex].name, soulID)).toAutomarker()))
	return;
}

function HandleTapeCollect(tapeID, teamObj) {
	console.log(`[${GetNow()}] Team ${teamObj.name} have collected the ${GetTapeFromID(tapeID)} tape.`);
	teamObj.tapes.push(GetTapeFromID(tapeID));
	SendToNodeCG("tape_collected", teamObj.OutputTeamTapes());
	return;
}

function HandleSoulUnlock(soulNum, teamObj) {
	let soulInfo = GetSoulInfoFromNumber(soulNum);
	console.log(`[${GetNow()}] Team ${teamObj.name} have unlocked ${soulInfo.name} in ${soulInfo.area}.`);
	return;
}

function HandleCharUnlock(charID, playerIndex, teamObj) {
	console.log(`[${GetNow()}] Player ${teamObj.players[playerIndex].name} has unlocked character ${GetCharacterFromID(charID)}.`);
	kevingoSocket.send(JSON.stringify((new BingoEvent("Char", teamObj.players[playerIndex].name, GetCharacterFromID(charID))).toAutomarker()))
	return;
}

// Player Tracker?
function HandleAreaChange(levelID, playerIndex, teamObj) {
	if (playerIndex != undefined) 
	{
		teamObj.players[playerIndex]["location"] = levelID;
		teamObj.players[playerIndex]["enterTimestamp"] = Date.now();
		console.log(`[${GetNow()}] Player ${teamObj.players[playerIndex].name} has moved to ${GetLevelFromID(levelID)} at timestamp ${teamObj.players[playerIndex].enterTimestamp}.`);

		// There has to be a better way to make an object inside an object. Right?
		// Next time, here's the structure
		/*
		{
			"event": "areachange",
			"team": "teamname",
			"players": {
				"player1name": "asdf",
				"player2name": "fdsa"
			},
			"asdf": {"location": 161920, "timestamp": 17547382597843},
			"fdsa": {"location": 161921, "timestamp": 17853705289371},
		} 
		*/
		let returnObj = {}
		let locationObj = {}
		let playerObj = {};
		//console.log(teamObj);
		playerObj["location"] = GetLevelFromID(levelID);
		playerObj["enterTimestamp"] = Date.now();
		locationObj[teamObj.players[playerIndex].name] = playerObj;
		returnObj[teamObj.surgeID] = locationObj; 	
		//console.log(returnObj);
		SendToNodeCG("player_location_change", returnObj);
	} else {
		console.log("Unknown Player Location (they haven't moved)");
	}
	return;
}

function HandleKillCombo(teamObj) {
	teamObj.graffiti = InitTagData();
	teamObj.tapes = [];
	SendToNodeCG("kill_combo", teamObj.surgeID);
	// SendToNodeCG("graffiti/set", teamObj.OutputAbbreviatedGraffiti());
	// SendToNodeCG("mysterytape/set", teamObj.OutputTeamTapes());
}

/*
Helper/Data functions.
*/

// const originalWebSocketSend = WebSocket.prototype.send;
// WebSocket.prototype.send = function (type, message) {
//     if (typeof message !== 'string') {
//         message = JSON.stringify(message);
//     }
//     wsSend = {
//         "source": WS_SOURCE,
//         "timestamp": Date.now(),
//         "type": type,
//         "message": message,
//     }
//     originalWebSocketSend.call(this, JSON.stringify(wsSend)); // Or modifiedData if applicable
// };

function GetNow() {
	let rightNow = new Date();
	return rightNow.toLocaleTimeString().split(" ")[0] + "." + (rightNow.getMilliseconds() + "000").slice(0,3);
}

function Commafy(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function dwsToString(dw1, dw2, dw3) {
    function dwToBytes(dw) {
        return [dw & 0xFF, (dw >> 8) & 0xFF, (dw >> 16) & 0xFF, (dw >> 24) & 0xFF];
    }
    let allBytes = [...dwToBytes(dw1), ...dwToBytes(dw2), ...dwToBytes(dw3)];
    return String.fromCharCode(...allBytes.filter(b => b !== 0));
}

function SendToNodeCG(type, message) {
    if (typeof message !== 'string') {
        message = JSON.stringify(message);
    }
    wsSend = {
        "source": WS_SOURCE,
        "timestamp": Date.now(),
        "type": type,
        "message": message,
    }
	nodecgServer.send(JSON.stringify(wsSend));
}

function GetLevelFromID(levelInt) {
	switch (levelInt) {
		case 0:
			return LEVELS.GARAGE;
		case 65536:
			return LEVELS.SHIBUYA;
		case 65537:
			return LEVELS.CHUO;
		case 65538:
			return LEVELS.DOGEN;
		case 65539:
			return LEVELS.HIKAGE;
		case 131072:
			return LEVELS.RDH;
		case 131073:
			return LEVELS.SEWERS;
		case 131074:
			return LEVELS.KIBO;
		case 131075:
			return LEVELS.BOTTOMPOINT;
		case 131076:
			return LEVELS.FRZ;
		case 196608:
			return LEVELS.x99TH;
		case 196609:
			return LEVELS.SKYDINO;
		case 196610:
			return LEVELS.STADIUM;
		case 196611:
			return LEVELS.HWY0;
		case 196612:
			return LEVELS.SKYSCRAPER;
		default:
			return "Other/Unknown";
	}
}

function GetTapeFromID(tapeID) {
	switch (tapeID) {
		case 0:
			return LEVELS.SHIBUYA;
		case 1:
			return LEVELS.CHUO;
		case 2:
			return LEVELS.DOGEN;
		case 3:
			return LEVELS.HIKAGE;
		case 4:
			return LEVELS.RDH;
		case 5:
			return LEVELS.SEWERS;
		case 6:
			return LEVELS.KIBO;
		case 7:
			return LEVELS.BOTTOMPOINT;	
		case 8:
			return LEVELS.FRZ;
		case 9:
			return LEVELS.x99TH;
		case 10:
			return LEVELS.SKYDINO;
		case 11:
			return LEVELS.HWY0;
		case 12:
			return LEVELS.SKYSCRAPER;
		default:
			return "Unknown/Error";
	}
}

function GetCharacterFromID(charID) {
	switch (charID) {
		case 10:
			return "Cube";
		case 4:
			return "Rhyth";
		case 21:
			return "Jazz";
		case 5:
			return "Soda";
		case 9:
			return "Boogie";
		default:
			return "Unknown/Error";
	}
}

function GetSoulInfoFromNumber(soulNum) {
	switch (soulNum) {
		case 5:
			return {"area": LEVELS.DOGEN, "name": "Isolated platform down hill", "type": "default"};
		case 6:
			return {"area": LEVELS.DOGEN, "name": "Tricks x 20", "type": "tape"};
		case 7:
			return {"area": LEVELS.SHIBUYA, "name": "On top of bus", "type": "default"};
		case 8:
			return {"area": LEVELS.SHIBUYA, "name": "Special (13 platforms)", "type": "tape"};
		case 9:
			return {"area": LEVELS.CHUO, "name": "Air x 4", "type": "tape"};
		case 10:
			return {"area": LEVELS.RDH, "name": "Top of station", "type": "default"};
		case 11:
			return {"area": LEVELS.RDH, "name": "Points x 40k", "type": "tape"};
		case 12:
			return {"area": LEVELS.x99TH, "name": "Grind x 15", "type": "tape"};
		case 13:
			return {"area": LEVELS.SEWERS, "name": "Entrance", "type": "default"};
		case 15:
			return {"area": LEVELS.SEWERS, "name": "Tricks x 45", "type": "tape"};
		case 16:
			return {"area": LEVELS.BOTTOMPOINT, "name": "Catwalk, PJ Room 3", "type": "default"};
		case 17:
			return {"area": LEVELS.BOTTOMPOINT, "name": "Special (Points x 70k)", "type": "tape"};
		case 18:
			return {"area": LEVELS.HIKAGE, "name": "Air x 4", "type": "tape"};
		case 19:
			return {"area": LEVELS.KIBO, "name": "Under tower", "type": "default"};
		case 21:
			return {"area": LEVELS.KIBO, "name": "Points x 250k", "type": "tape"};
		case 22:
			return {"area": LEVELS.SKYSCRAPER, "name": "Grind x 20", "type": "tape"};
		case 23:
			return {"area": LEVELS.HWY0, "name": "Directly under entrance", "type": "default"};
		case 24:
			return {"area": LEVELS.HWY0, "name": "Tricks x 70", "type": "tape"};
		case 26:
			return {"area": LEVELS.SKYDINO, "name": "On top of T-rex", "type": "default"};
		case 27:
			return {"area": LEVELS.SKYDINO, "name": "Points x 10k", "type": "tape"};
		case 28:
			return {"area": LEVELS.FRZ, "name": "Grind x 10", "type": "tape"};

		case 34:
			return {"area": LEVELS.DOGEN, "name": "Right of Street", "type": "default"};
		case 35:
			return {"area": LEVELS.DOGEN, "name": "Points x 50k", "type": "tape"};
		case 36:
			return {"area": LEVELS.SHIBUYA, "name": "Grind x 10", "type": "tape"};
		case 37:
			return {"area": LEVELS.CHUO, "name": "Right Canal", "type": "default"};
		case 38:
			return {"area": LEVELS.CHUO, "name": "Tricks x 30", "type": "tape"};
		case 39:
			return {"area": LEVELS.RDH, "name": "Lookout (Cops 2)", "type": "default"};
		case 40:
			return {"area": LEVELS.RDH, "name": "Special (Grind Lower Chimney)", "type": "tape"};
		case 41:
			return {"area": LEVELS.x99TH, "name": "Air x 4", "type": "tape"};
		case 42:
			return {"area": LEVELS.SEWERS, "name": "Center structure", "type": "default"};
		case 43:
			return {"area": LEVELS.SEWERS, "name": "Points x 100k", "type": "tape"};
		case 44:
			return {"area": LEVELS.BOTTOMPOINT, "name": "Grind x 10", "type": "tape"};
		case 45:
			return {"area": LEVELS.HIKAGE, "name": "Cubby", "type": "default"};
		case 46:
			return {"area": LEVELS.HIKAGE, "name": "Tricks x 55", "type": "tape"};
		case 47:
			return {"area": LEVELS.KIBO, "name": "Under wires (huh)", "type": "default"};
		case 49:
			return {"area": LEVELS.KIBO, "name": "Special (Walk under gate at top)", "type": "tape"};
		case 50:
			return {"area": LEVELS.SKYSCRAPER, "name": "Air x 4", "type": "tape"};
		case 51:
			return {"area": LEVELS.HWY0, "name": "Left alley near phone booth", "type": "default"};
		case 52:
			return {"area": LEVELS.HWY0, "name": "Points x 90k", "type": "tape"};
		case 54:
			return {"area": LEVELS.SKYDINO, "name": "Under Brontosaurus", "type": "default"};
		case 55:
			return {"area": LEVELS.SKYDINO, "name": "Special (Rail, Swing, Rail)", "type": "tape"};
		case 56:
			return {"area": LEVELS.FRZ, "name": "Air x 8", "type": "tape"};

		case 61:
			return {"area": LEVELS.DOGEN, "name": "Past Statue", "type": "default"};
		case 62:
			return {"area": LEVELS.DOGEN, "name": "Special (Grind Avenue)", "type": "tape"};
		case 63:
			return {"area": LEVELS.SHIBUYA, "name": "Air x 3", "type": "tape"};
		case 64:
			return {"area": LEVELS.CHUO, "name": "Cubby", "type": "default"};
		case 65:
			return {"area": LEVELS.CHUO, "name": "Points x 60k", "type": "tape"};
		case 67:
			return {"area": LEVELS.RDH, "name": "Grind x 10", "type": "tape"};
		case 68:
			return {"area": LEVELS.x99TH, "name": "Center of Dark", "type": "default"};
		case 69:
			return {"area": LEVELS.x99TH, "name": "Tricks x 40", "type": "tape"};
		case 70:
			return {"area": LEVELS.SEWERS, "name": "Rail, Floor 1 to 2", "type": "default"};
		case 71:
			return {"area": LEVELS.SEWERS, "name": "Special (Points x 150k)", "type": "tape"};
		case 72:
			return {"area": LEVELS.BOTTOMPOINT, "name": "Air x 4", "type": "tape"};
		case 73:
			return {"area": LEVELS.HIKAGE, "name": "Crane", "type": "default"};
		case 74:
			return {"area": LEVELS.HIKAGE, "name": "Points x 300k", "type": "tape"};
		case 76:
			return {"area": LEVELS.KIBO, "name": "Grind x 20", "type": "tape"};
		case 77:
			return {"area": LEVELS.SKYSCRAPER, "name": "Top of Observatory", "type": "default"};
		case 79:
			return {"area": LEVELS.SKYSCRAPER, "name": "Tricks x 60", "type": "tape"};
		case 80:
			return {"area": LEVELS.HWY0, "name": "Trash Pit", "type": "default"};
		case 81:
			return {"area": LEVELS.HWY0, "name": "Special (Wallride Alley)", "type": "tape"};
		case 82:
			return {"area": LEVELS.SKYDINO, "name": "Grind x 50", "type": "tape"};
		case 83:
			return {"area": LEVELS.FRZ, "name": "'Clip' soul, lower area", "type": "default"};
		case 84:
			return {"area": LEVELS.FRZ, "name": "Tricks x 100", "type": "tape"};

		case 92:
			return {"area": LEVELS.DOGEN, "name": "Grind x 10", "type": "tape"};
		case 93:
			return {"area": LEVELS.SHIBUYA, "name": "Cubby", "type": "default"};
		case 94:
			return {"area": LEVELS.SHIBUYA, "name": "Tricks x 25", "type": "tape"};
		case 95:
			return {"area": LEVELS.CHUO, "name": "South of Hayashi", "type": "default"};
		case 96:
			return {"area": LEVELS.CHUO, "name": "Special (G/W to end)", "type": "tape"};
		case 97:
			return {"area": LEVELS.RDH, "name": "Air x 4", "type": "tape"};
		case 98:
			return {"area": LEVELS.x99TH, "name": "Light Wallride", "type": "default"};
		case 99:
			return {"area": LEVELS.x99TH, "name": "Points x 100k", "type": "tape"};
		case 100:
			return {"area": LEVELS.SEWERS, "name": "Grind x 10", "type": "tape"};
		case 101:
			return {"area": LEVELS.BOTTOMPOINT, "name": "Tunnel before Cube", "type": "default"};
		case 102:
			return {"area": LEVELS.BOTTOMPOINT, "name": "Tricks x 50", "type": "tape"};
		case 103:
			return {"area": LEVELS.HIKAGE, "name": "Center, floating", "type": "default"};
		case 104:
			return {"area": LEVELS.HIKAGE, "name": "Special (Crane, Top, Bottom)", "type": "tape"};
		case 105:
			return {"area": LEVELS.KIBO, "name": "Air x 4", "type": "tape"};
		case 106:
			return {"area": LEVELS.SKYSCRAPER, "name": "Floating, Pink halfpipes", "type": "default"};
		case 107:
			return {"area": LEVELS.SKYSCRAPER, "name": "Points x 110k", "type": "tape"};
		case 108:
			return {"area": LEVELS.HWY0, "name": "Grind x 15", "type": "tape"};
		case 109:
			return {"area": LEVELS.SKYDINO, "name": "Platform near starting spiral", "type": "default"};
		case 110:
			return {"area": LEVELS.SKYDINO, "name": "Air x 6", "type": "tape"};
		case 111:
			return {"area": LEVELS.FRZ, "name": "Down tube", "type": "default"};
		case 112:
			return {"area": LEVELS.FRZ, "name": "Points x 50k", "type": "tape"};

		case 117:
			return {"area": LEVELS.DOGEN, "name": "Air x 3", "type": "tape"};
		case 119:
			return {"area": LEVELS.SHIBUYA, "name": "Platform", "type": "default"};
		case 121:
			return {"area": LEVELS.SHIBUYA, "name": "Points x 100k", "type": "tape"};
		case 122:
			return {"area": LEVELS.CHUO, "name": "Grind x 10", "type": "tape"};
		case 123:
			return {"area": LEVELS.RDH, "name": "Sauna", "type": "default"};
		case 124:
			return {"area": LEVELS.RDH, "name": "Tricks x 35", "type": "tape"};
		case 126:
			return {"area": LEVELS.x99TH, "name": "Wallride to dark", "type": "default"};
		case 127:
			return {"area": LEVELS.x99TH, "name": "Special (Perimeter of Tower)", "type": "tape"};
		case 128:
			return {"area": LEVELS.SEWERS, "name": "Air x 4", "type": "tape"};
		case 129:
			return {"area": LEVELS.BOTTOMPOINT, "name": "Right halfpipe after winding rails", "type": "default"};
		case 130:
			return {"area": LEVELS.BOTTOMPOINT, "name": "Points x 50k", "type": "tape"};
		case 131:
			return {"area": LEVELS.HIKAGE, "name": "Grind x 20", "type": "tape"};
		case 132:
			return {"area": LEVELS.KIBO, "name": "Upper platform at end", "type": "default"};
		case 133:
			return {"area": LEVELS.KIBO, "name": "Tricks x 60", "type": "tape"};
		case 134:
			return {"area": LEVELS.SKYSCRAPER, "name": "Entrance Pillar", "type": "default"};
		case 135:
			return {"area": LEVELS.SKYSCRAPER, "name": "Special (Circle the Pharaoh)", "type": "tape"};
		case 136:
			return {"area": LEVELS.HWY0, "name": "Air x 5", "type": "tape"};
		case 137:
			return {"area": LEVELS.SKYDINO, "name": "Building under swings", "type": "default"};
		case 138:
			return {"area": LEVELS.SKYDINO, "name": "Tricks x 100", "type": "tape"};
		case 139:
			return {"area": LEVELS.FRZ, "name": "End of first Maze", "type": "default"};
		case 140:
			return {"area": LEVELS.FRZ, "name": "Special (Grind up the metal)", "type": "tape"};

		default:
			return "Other/Unknown";
	}
}

function InitTagData() {
	let dogen = new Level(65538,
		[[67, "S", "upper area"], 
		 [68, "SS", "upper area"],
		 [69, "M", "upper area"],
		 [64, "SS", "upper area"],
		 [70, "L", "upper area"],
		 [65, "S", "upper area"],
		 [66, "SS", "upper area"],
		 [32, "M", "tricks"],
		 [33, "S", "tricks"],
		 [11, "L", "first any%"],
		 [4, "L", "first any%"],
		 [34, "M", "M on rail"],
		 [21, "SS", "hill curve 1"],
		 [20, "M", "hill curve 1"],
		 [22, "S", "hill curve 1"],
		 [23, "SS", "hill curve 1"],
		 [24, "M", "hill curve 1"],
		 [37, "L", "points"],
		 [26, "SS", "hill curve 2"],
		 [27, "S", "hill curve 2"],
		 [25, "XL", "hill curve 2"],
		 [28, "S", "hill curve 2"],
		 [29, "SS", "hill curve 2"],
		 [7, "M", "hill curve 2"],
		 [44, "L", "building"],
		 [45, "M", "isolated platform"],
		 [62, "L", "slope"],
		 [12, "L", "rail"],
		 [60, "L", "pre-slope"],
		 [10, "M", "last any%"],
		 [9, "L", "last any%"],
		 [47, "M", "Corner"],
		 [71, "L", "rail up to market"],
		 [51, "M", "top market"],
		 [52, "M", "mid market"],
		 [59, "M", "floor market"],
		 [58, "SS", "floating 3"],
		 [57, "SS", "floating 2"],
		 [56, "SS", "floating 1"],
		 [53, "SS", "exit"],
		 [54, "SS", "exit"],
		 [55, "SS", "exit"]]);

	let shibuya = new Level(65536, 
		[[69, "XL", "Near Entrance"],
		 [67, "M", "Next to Cubby"],
		 [14, "M", "Next to Grind"],
		 [15, "M", "Behind Pickle"],
		 [16, "M", "Left of Pickle"],
		 [40, "M", "Bus near Cubby"],
		 [39, "M", "Bus near Cubby"],
		 [21, "S", "Bus near Hikage"],
		 [22, "S", "Bus near Hikage"],
		 [23, "S", "Bus near Hikage"],
		 [24, "S", "Bus near Hikage"],
		 [25, "S", "Bus near Hikage"],
		 [26, "S", "Bus near Hikage"],
		 [36, "M", "Bus near Hikage"],
		 [37, "M", "Bus near Hikage"],
		 [72, "M", "Elevated Near Chuo"],
		 [58, "XL", "Bus Platform"],
		 [51, "S", "Wallride"],
		 [52, "S", "Wallride"],
		 [53, "S", "Wallride"],
		 [45, "SS", "On Ramp"],
		 [46, "S", "On Ramp"],
		 [47, "SS", "On Ramp"],
		 [63, "L", "Near Tricks"],
		 [7, "SS", "Curving rail"],
		 [8, "SS", "Curving rail"],
		 [9, "SS", "Curving rail"],
		 [10, "SS", "Curving rail"],
		 [11, "SS", "Curving rail"],
		 [13, "S", "Along combo challenge"],
		 [38, "L", "Near Air"],
		 [6, "S", "Combo challenge pillar"],
		 [41, "L", "Near Air"],
		 [5, "S", "Combo challenge pillar"],
		 [4, "S", "Pillar near Air"],
		 [3, "S", "Pillar near Air"],
		 [12, "M", "Ground near Chuo"],
		 [27, "SS", "Bus near Combo"],
		 [28, "SS", "Bus near Combo"],
		 [29, "S", "Bus near Combo"],
		 [30, "SS", "Bus near Combo"],
		 [31, "SS", "Bus near Combo"],
		 [32, "S", "Bus near Combo"],
		 [33, "SS", "Bus near Combo"],
		 [34, "S", "Bus near Combo"],
		 [35, "S", "Bus near Combo"],
		 [71, "L", "Tape platform"],
		 [42, "XL", "Tape platform"]]);

	let chuo = new Level(65537, 
		[[36, "XL", "Between buildings"],
		[57, "S", "Dropdown after terminal warp"],
		[39, "SS", "Stairs to Hayashi Platform"],
		[17, "L", "Hayashi Platform"],
		[42, "S", "Billboard from Hayashi Platform"],
		[18, "M", "Right Street 1"],
		[20, "S", "Right Street 2"],
		[19, "SS", "Right Street 3"],
		[21, "M", "Right Street 4"],
		[43, "SS", "Billboard on street 1"],
		[44, "S", "Billboard on street 2"],
		[45, "SS", "Billboard on street 3"],
		[22, "M", "Right Street 5"],
		[23, "L", "Right Street 6"],
		[71, "L", "Right Street 7"],
		[15, "XL", "Right of Street 8"],
		[64, "L", "Right Canal"],
		[27, "L", "Middle Canal"],
		[28, "M", "Middle Canal 2"],
		[59, "SS", "Billboards after Cubby"],
		[47, "S", "Billboard after Cubby 2"],
		[3, "SS", "Boost Markets 1"],
		[4, "SS", "Boost Markets 2"],
		[5, "SS", "Boost Markets 3"],
		[6, "SS", "Boost Markets 4"],
		[7, "SS", "Boost Markets 5"],
		[48, "M", "Special Grind 1"],
		[49, "SS", "Special Grind 2"],
		[50, "SS", "Special Grind 3"],
		[51, "SS", "Special Grind 4"],
		[60, "SS", "Alleyway 1st Jump 1"],
		[53, "S", "Alleyway 1st Jump 2"],
		[61, "SS", "Alleyway 2nd Jump 1"],
		[52, "S", "Alleyway 2nd Jump 2"],
		[14, "L", "Alleyway Middle"],
		[54, "S", "Alleyway Billboard"],
		[62, "SS", "Alleyway Billboard Jump"],
		[9, "L", "End of Alleyway"],
		[24, "XL", "XL under Octopuss"],
		[30, "S", "South of Chameleon"],
		[25, "M", "South East of Chameleon"],
		[26, "L", "East of Chameleon"],
		[16, "M", "East of Chameleon 2"],
		[10, "M", "Right Ramp 1"],
		[12, "S", "Right Ramp 2"],
		[11, "S", "Right Ramp 3"],
		[13, "XL", "Right Ramp 4"],
		[31, "S", "Left Ramp 1"],
		[32, "SS", "Left Ramp 2"],
		[8, "L", "Left Ramp 3"]]);
	
	let hikage = new Level(65539, 
		[[53, "XL", "Right Ramp 1st"],
		[41, "L", "Right Ramp 2nd"],
		[42, "M", "Before Right Alley"],
		[55, "L", "Right Alley 1"],
		[43, "SS", "Right Alley 2"],
		[54, "XL", "Right Alley 3"],
		[31, "M", "Right Alley 4"],
		[37, "M", "West of Crane 1"],
		[14, "S", "West of Crane 2"],
		[20, "S", "North of Crane"],
		[16, "S", "South East of Crane 1"],
		[18, "S", "South East of Crane 2"],
		[19, "M", "Before final stairs"],
		[15, "SS", "After stairs"],
		[36, "S", "After stairs billboard"],
		[32, "L", "Large top of entrance"],
		[38, "L", "Large top of entrance 2"],
		[12, "M", "Construction room 2"],
		[11, "S", "Contruction room 1"],
		[13, "SS", "Outside Construction room"],
		[17, "L", "Top corner isolated"],
		[30, "M", "any% Terrordrone defeat spawnpoint"],
		[21, "M", "4th level spray 3"],
		[22, "SS", "4th level spray 2"],
		[35, "XL", "4th level spray 1"],
		[28, "M", "Construction room entrance"],
		[23, "SS", "Constrction room right 1"],
		[39, "S", "Construction room right 2"],
		[24, "SS", "Contruction room left 2"],
		[25, "S", "contruction room left 1"],
		[27, "M", "5th Level spray 1"],
		[26, "S", "5th Level spray 2"],
		[59, "XL", "Ground Level XL"],
		[58, "M", "Left Side Ramp"],
		[60, "M", "Left Alley 1"],
		[52, "XL", "Left Alley 2"],
		[45, "L", "Left Alley 3"],
		[46, "SS", "Left Alley 4"],
		[47, "S", "Left Alley 5"],
		[48, "XL", "Left Alley 6"],
		[49, "S", "After Tape 1"],
		[50, "SS", "After Tape 2"],
		[51, "M", "After Tape 3"],
		[34, "L", "After Tape 4"],
		[40, "M", "Platform before tricks soul"],
		[4, "S", "Tricks soul"],
		[33, "L", "Tricks soul"],
		[57, "M", "Wallride with cans"],
		[6, "S", "Air soul"],
		[7, "M", "Air soul"],
	]);

	let RDH = new Level(131072, 
		[[8, "SS", "Electrical Pole Entrance 1"],
		[7, "SS", "Electrical Pole Entrance 2"],
		[15, "SS", "Grind Before Trailer 1"],
		[16, "S", "Grind Before Trailer 2"],
		[17, "SS", "Grind Before Trailer 3"],
		[18, "SS", "Grind Before Trailer 4"],
		[19, "S", "Grind Before Trailer 5"],
		[6, "SS", "Grind After Trailer 1"],
		[5, "SS", "Grind After Trailer 2"],
		[4, "S", "Grind After Trailer 3"],
		[3, "S", "Grind After Trailer 4"],
		[9, "S", "Grind Before Rhyth 1"],
		[10, "SS", "Grind Before Rhyth 2"],
		[54, "S", "Grind After Rhyth"],
		[53, "M", "Left of Pipe to Rhyth 2nd Spawn"],
		[60, "L", "Right of Pipe to Rhyth 2nd Spawn"],
		[52, "S", "Corner Jump to Tower"],
		[50, "S", "Grind before tower"],
		[47, "S", "Special Tower Unlock 1"],
		[48, "S", "Special Tower Unlock 2"],
		[49, "S", "Special Tower Unlock 3"],
		[56, "S", "Grind Around Amalgamated Building 1"],
		[57, "SS", "Grind Around Amalgamated Building 2"],
		[71, "S", "Grind Around Amalgamated Building 3"],
		[51, "S", "Inside Amalgamated Building"],
		[45, "L", "Under Special Unlock Tower"],
		[55, "S", "Roof next to Tower"],
		[22, "SS", "Ripskip door 1"],
		[21, "S", "Ripskip door 2"],
		[20, "M", "Ripskip door 3"],
		[23, "L", "1st Cop Fight Spray"],
		[11, "XL", "Spray after Billboard jump"],
		[74, "S", "2nd Cop Fight Spray 1"],
		[73, "SS", "2nd Cop Fight Spray 2"],
		[29, "L", "2nd Cop Fight Spray 3"],
		[12, "L", "Large AFTER 2nd Cop Fight"],
		[13, "XL", "Before Sauna 1"],
		[33, "L", "Before Sauna 2"],
		[77, "XL", "Sauna"],
		[25, "SS", "Before Water Tower Area 1"],
		[24, "S", "Before Water Tower Area 2"],
		[26, "M", "Before Water Tower Area 3"],
		[30, "L", "Before Water Tower Area 4"],
		[27, "S", "Before Water Tower Area 5"],
		[28, "SS", "Before Water Tower Area 6"],
		[14, "M", "3rd Cop Fight Trigger"],
		[64, "L", "3rd Cop Fight Area 1"],
		[32, "XL", "3rd Cop Fight Area 2"],
		[31, "L", "3rd Cop Fight Area 3"],
		[58, "L", "Water Tower Grind"],
		[34, "S", "Water Tower Top 1"],
		[78, "SS", "Water Tower Top 2"],
		[76, "L", "Special Soul Tower"]
	]);

	let sewers = new Level(131073, 
		[[8, "SS", "After floor 1 to 2"],
		[7, "SS", "Below center structure"],
		[26, "M", "Below center structure"],
		[16, "L", "Before brown room"],
		[30, "S", "Brown room"],
		[27, "S", "Near 100m room"],
		[10, "S", "Small water room"],
		[29, "SS", "Small water room"],
		[9, "S", "Small water room"],
		[28, "SS", "Small water room"],
		[5, "SS", "Tunnels #1"],
		[3, "SS", "Tunnels #2"],
		[4, "SS", "Tunnels #3"],
		[6, "SS", "Tunnels #4"],
		[20, "S", "Room after tunnels"],
		[22, "M", "Room after tunnels"],
		[23, "M", "Curved halfpipe highest floor"],
		[25, "L", "Curved halflpipe highest floor"],
		[24, "M", "Curved halfpipe highest floor M#2"],
		[17, "SS", "Curved halfpipe highest floor"],
		[18, "SS", "Curved halfpipe highest floor SS#2"],
		[13, "SS", "100m room 40m"],
		[32, "S", "100m room 70m"],
		[31, "M", "100m room 100m"]
	]);

	let bottomPoint = new Level(131075, 
		[[3, "SS", "Above Catwalk 1-4"],
		[4, "SS", "Above Catwalk 1-4"],
		[5, "SS", "Above Catwalk 1-4"],
		[6, "SS", "Above Catwalk 1-4"],
		[9, "L", "Points Room"],
		[10, "M", "Points Room"],
		[7, "S", "Tunnel before Cube"],
		[8, "S", "Tunnel before Cube"],
		[11, "M", "Tunnel before Cube"],
		[12, "M", "Tunnel before Cube"],
		[13, "M", "Catwalk near air"],
		[15, "S", "PJ 1 Blue Rail"],
		[19, "L", "PJ 1 Catwalk"],
		[18, "M", "PJ 1 Catwalk"],
		[16, "S", "PJ 1 Catwalk"],
		[17, "S", "PJ 1 Catwalk"], //CHECK ME?
		[14, "S", "PJ 1 Orange Rail"],
		[20, "L", "In halfpipe"],
		[21, "S", "PJ 2 Orange Rail"],
		[22, "S", "PJ 2 Blue Rail"],
		[29, "XL", "Slope"],
		[23, "S", "PJ 3 Orange Rail"],
		[24, "S", "PJ 3 Orange Rail"],
		[25, "S", "PJ 3 Orange Rail"],
		[28, "XL", "PJ 3 Catwalk"],
		[30, "L", "PJ 3 Catwalk"],
		[31, "S", "PJ 3 Catwalk"],
		[32, "S", "PJ 3 Catwalk"]
	]);

	let kibo = new Level(131074, 
		[[27, "M", "M above entrance"],
		[13, "XL", "1st XL cretin cycle"],
		[29, "M", "M after XL"],
		[22, "L", "L cretin cycle"],
		[5, "XL", "2nd Xl cretin cycle on roof"],
		[31, "S", "S cat room"],
		[32, "SS", "SS cat room"],
		[30, "M", "M cat room"],
		[3, "S", "S escape cycle"],
		[4, "SS", "SS escape cycle"],
		[6, "S", "S escape cycle #2"],
		[36, "SS", "SS room with long right angle pipe"],
		[37, "SS", "SS room with long right angle pipe #2"],
		[33, "XL", "XL room with long right angle pipe"],
		[35, "SS", "SS room with long right angle pipe #3"],
		[34, "M", "M room with long right angle pipe"],
		[40, "SS", "SS near air 4"],
		[41, "S", "S near air 4"],
		[9, "S", "S escape cycle #4"],
		[8, "S", "S escape cycle #3"],
		[38, "M", "M near grind 20"],
		[10, "S", "S escape cycle #5"],
		[43, "S", "S in hole below escape cycle"],
		[44, "M", "M in hole below escape cycle"],
		[47, "M", "M near points 250k"],
		[46, "S", "S near points 250k"],
		[11, "XL", "XL after tunnel"],
		[12, "SS", "SS after tunnel"],
		[14, "S", "S after tunnel"],
		[21, "S", "S before boogie room"],
		[17, "L", "L on floor before boogie room"],
		[19, "L", "L on wall before boogie room"],
		[15, "M", "M on curved pipe before boogie room"],
		[52, "S", "S in boogie room"],
		[53, "M", "M in boogie room"],
		[51, "XL", "XL in boogie room"],
		[55, "L", "L in boogie room"],
		[72, "S", "S after furthest right wire up top"],
		[71, "M", "M near special gate"],
		[74, "L", "L near special gate"],
		[68, "M", "M under special gate on wire"],
		[78, "L", "L under special gate near blue cans"],
		[65, "S", "S right wire with cool quickturn"],
		[25, "M", "M near huh soul"],
		[26, "L", "L near huh? soul"],
		[7, "S", "S near huh? soul"],
		[16, "SS", "SS near huh? soul"],
		[24, "XL", "XL near huh? soul"],
		[73, "SS", "SS near tape"],
		[75, "L", "L near tape"],
		[61, "M", "M near special unlock"],
		[60, "L", "L near special unlock"]
	]);

	let FRZ = new Level(131076, 
		[[31, "M", "M 2nd floor"],
		[32, "XL", "XL 2nd floor"],
		[35, "S", "S 3rd floor"],
		[33, "M", "M 3rd floor"],
		[34, "L", "L 3rd floor"],
		[40, "M", "M 4th floor"],
		[36, "XL", "XL 4th floor"],
		[39, "SS", "SS 4th floor"],
		[38, "S", "S 4th floor"],
		[37, "M", "M 4th floor #2"],
		[10, "S", "S near 1st red device"],
		[41, "M", "M near 1st red device"],
		[9, "S", "S near 1st red device #2"],
		[42, "S", "S near 1st red device #3"],
		[11, "S", "S near 1st red device #4",],
		[12, "M", "M near 1st red device #2"],
		[13, "M", "M near 3rd red device"],
		[14, "M", "M near 3rd red device #2"],
		[43, "XL", "XL near last red device"],
		[49, "L", "L near 3rd red device"],
		[48, "L", "L near 3rd red device #2"],
		[50, "S", "S beside 4th red device"],
		[57, "L", "L closer to 5th red device"],
		[51, "L", "L further from 5th red device"],
		[52, "M", "M near 5th red device"],
		[53, "L", "L beside 6th red device"],
		[59, "M", "M before aaron jump"],
		[58, "S", "S before aaron jump"],
		[60, "S", "1st maze S"],
		[61, "SS", "1st maze SS"],
		[62, "S", "1st maze S #2"],
		[16, "M", "2nd maze M"],
		[17, "SS", "2nd maze SS"],
		[63, "S", "2nd maze S"],
		[64, "S", "2nd maze S #2"],
		[65, "M", "3rd maze M"],
		[66, "S", "3rd maze S"],
		[45, "SS", "SS above tape"],
		[46, "S", "S above tape"],
		[47, "SS", "SS above tape #2"],
		[44, "M", "M beside tape"],
		[3, "M", "6th blue device"],
		[67, "S", "7th blue device"],
		[4, "L", "Last blue device"],
		[7, "M", "M beside clip soul"],
		[29, "L", "L jumped to from clip soul"],
		[68, "S", "S 3rd blue device"]
	]);

	let x99th = new Level(196608, 
		[[52, "XL", "Next to Special Unlock"],
		[39, "L", "Next to Blue Can Haven"],
		[69, "S", "Next to Blue Can Haven 2"],
		[35, "M", "Lady Pub Shop"],
		[38, "S", "Billboard Grind Jump 1"],
		[54, "L", "Billboard Grind Jump 2"],
		[48, "XL", "South of Mushroom"],
		[31, "M", "Rail to Roof 1"],
		[25, "SS", "Rail to Roof 2"],
		[26, "SS", "Rail to Roof 3"],
		[27, "SS", "Rail to Roof 4"],
		[36, "S", "Orange Shop near rail"],
		[47, "L", "Rail above 7 shop"],
		[37, "SS", "Rail left of 7 Shop"],
		[53, "S", "Rail before Blue Can Haven"],
		[3, "M", "Middle Pathway in Lightside"],
		[40, "L", "Hard Light"],
		[50, "S", "Below Hard Light 2"],
		[49, "S", "Below Hard Light 1"],
		[51, "M", "99th Special Soul"],
		[55, "XL", "North of Mushroom"],
		[12, "S", "Rails Grind 1"],
		[56, "M", "Rails Grind 2"],
		[17, "S", "Rails Grind 3"],
		[18, "S", "Rails Grind 4"],
		[57, "M", "Rails Grind 5"],
		[58, "S", "Rails Grind 6"],
		[60, "M", "After Rails Grind"],
		[33, "XL", "Water 1"],
		[29, "M", "Water 2"],
		[19, "SS", "Water 3"],
		[32, "L", "Water 4"],
		[20, "S", "Water 5"],
		[21, "S", "Water 6"],
		[22, "S", "Water 7"],
		[28, "M", "Water 8"],
		[42, "L", "Before Wallride to Dark"],
		[41, "M", "Hard Dark"],
		[65, "S", "Billboard to Hard Dark"],
		[9, "M", "Center of Dark 1"],
		[8, "S", "Center of Dark 2"],
		[7, "SS", "Center of Dark 3"],
		[6, "SS", "Center of Dark 4"],
		[5, "SS", "Center of Dark 5"],
		[4, "SS", "Center of Dark 6"],
		[24, "S", "Billboard Right of Dark"],
		[13, "S", "Billboard to Roof 1"],
		[14, "SS", "Billboard to Roof 2"],
		[16, "S", "Billboard to Roof 3"],
		[30, "L", "Billboard to Roof 4"],
		[71, "SS", "Dark Rails 1"],
		[66, "M", "Dark Rails 2"],
		[63, "S", "Dark Rails 3"],
		[68, "L", "Dark Rails 4"],
		[23, "M", "Dark Rails 5"],
		[64, "SS", "Dark Rails 6"],
		[70, "M", "Dark Rails 7"],
		[72, "S", "Dark Rails 8"],
		[67, "M", "Dark Rails 9"],
		[34, "L", "Dark Rails 10"],
		[43, "S", "Grind to Dark 1"],
		[61, "L", "Grind to Dark 2"],
		[44, "S", "Grind to Dark 3"],
		[62, "SS", "Grind to Dark 4"]
	]);

	let SDPP = new Level(196612, 
		[[6, "S", "Top of Pyramid"],
		[33, "M", "Base of Pyramid"],
		[26, "L", "Under Pyramid"],
		[8, "S", "West of Center 1"],
		[15, "M", "West of Center 2"],
		[7, "SS", "West of Center 3"],
		[14, "XL", "West of Center 4"],
		[9, "SS", "West of Center 5"],
		[41, "L", "South East of Center 1"],
		[23, "M", "South East of Center 2"],
		[39, "M", "Above HW0 1"],
		[40, "L", "Above HW0 2"],
		[11, "M", "After Huge Billboards on Crates"],
		[17, "L", "Before Points Soul Crane Area"],
		[34, "L", "Grind Soul Crane Area"],
		[28, "L", "Points Soul Crane Area"],
		[19, "L", "Before Graffiti Stop 1"],
		[38, "L", "Before Graffiti Stop 2"],
		[42, "L", "Pink Half Pipes Left Side"],
		[36, "L", "Boost after Pink Half Pipes Left Side"],
		[5, "L", "Ramps to Pink Half Pipes Right Side"],
		[10, "XL", "Before Pink Halfpipes Right Side"],
		[35, "L", "Pink Half Pipes Right Side"],
		[31, "S", "Ramp to Satelite"],
		[18, "L", "Any% Deathwarp Spray"],
		[30, "S", "Satelite on top of crates"],
		[29, "L", "Observatory Deathwarp"],
		[37, "L", "Below crates near Observatory"],
		[47, "L", "On top of Observatory 1"],
		[46, "M", "On top of Observatory 2"],
		[48, "XL", "On top of Observatory 3"],
		[45, "M", "Next to block going to Observatory"],
		[12, "M", "Any% Left Side Warp 1"],
		[16, "L", "Any% Left Side Warp 2"],
		[44, "XL", "Next to Wallride to Tricks Soul"],
		[27, "L", "Tricks Soul location"],
		[22, "S", "Satelite grind near Tricks Soul"],
		[25, "L", "North East of Air Soul Crane"],
		[20, "L", "Right next to Air Soul Crane"],
		[13, "M", "Just before Air Soul Crane"]
	]);

	let skyDino = new Level(196609, 
		[[5, "XL", "Left of start"],
		[28, "M", "First spiral medium"],
		[29, "S", "First spiral small"],
		[30, "S", "Second spiral small"],
		[31, "M", "Second spiral medium"],
		[4, "M", "points 10k medium"],
		[6, "XL", "points 10k XL"],
		[25, "M", "medium near loops"], //check me
		[18, "XL", "XL on the side of air 6 theatre"],
		[17, "XL", "Grind 50 XL"],
		[27, "S", "Small above tape on a green rail"],
		[10, "S", "Small#1 ground level of tape"],
		[11, "S", "Small#2 ground level of tape"],
		[12, "M", "Medium above tape red rail"],
		[13, "S", "Small above tape red rail"],
		[32, "L", "Large close to platform swing default #1"],
		[20, "L", "Large close to platform swing default #2"],
		[7, "S", "Small near tail of Trex"],
		[8, "M", "Medium near tail of Trex"],
		[19, "SS", "Inside Trex towards special #1"],
		[21, "S", "Inside Trex towards special #1"],
		[14, "SS", "Inside Trex towards special #2"],
		[16, "SS", "Inside Trex towards special #3"],
		[22, "S", "Inside Trex towards special #2"],
		[3, "SS", "SS near special unlock"],
		[24, "SS", "Head of bronto"],
		[23, "XL", "Back of bronto"],
		[9, "S", "Small near tricks 100"],
		[15, "L", "Large inside tricks 100"]
	]);

	let highwayZero = new Level(196611, 
		[[31, "L", "Curved wall L"],
		[4, "M", "Curved wall M"],
		[17, "SS", "Billboard SS"],
		[18, "S", "Billboard S"],
		[19, "SS", "Billboard SS#2"],
		[20, "S", "Billboard S#2"],
		[16, "M", "Medium above soda"],
		[21, "L", "L above soda"],
		[22, "XL", "XL above soda"],
		[15, "S", "Winding pipes S"],
		[14, "SS", "Winding pipes SS"],
		[13, "S", "Winding pipes S#2"],
		[12, "SS", "Winding pipes SS#2"],
		[10, "S", "Winding pipes S#3"],
		[9, "SS", "Winding pipes SS#3"],
		[23, "SS", "Special wallride SS"],
		[24, "S", "Special wallride S"],
		[26, "SS", "Special wallride SS#2"],
		[25, "S", "Special wallride S#2"],
		[27, "SS", "Special wallride SS#3"],
		[28, "S", "Special wallride S#3"],
		[29, "S", "Trashpit billboard #1"],
		[3, "S", "Trashpit billboard #2"],
		[5, "XL", "XL near points 90k"],
		[7, "M", "Medium near entrance highway"]
	]);

	let returnObj = {};
	returnObj[LEVELS.DOGEN] = dogen;
	returnObj[LEVELS.SHIBUYA] = shibuya;
	returnObj[LEVELS.CHUO] = chuo;
	returnObj[LEVELS.HIKAGE] = hikage;
	returnObj[LEVELS.RDH] = RDH;
	returnObj[LEVELS.SEWERS] = sewers;
	returnObj[LEVELS.KIBO] = kibo;
	returnObj[LEVELS.BOTTOMPOINT] = bottomPoint;
	returnObj[LEVELS.FRZ] = FRZ;
	returnObj[LEVELS.x99TH] = x99th;
	returnObj[LEVELS.SKYSCRAPER] = SDPP;
	returnObj[LEVELS.SKYDINO] = skyDino;
	returnObj[LEVELS.HWY0] = highwayZero;
	returnObj[LEVELS.STADIUM] = null;
	returnObj[LEVELS.GARAGE] = null;
	
	return returnObj;
}

module.exports = {
    HandlePlayerRegister, launchAutomarker
};