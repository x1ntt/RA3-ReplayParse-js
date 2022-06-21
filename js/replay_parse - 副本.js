const MAGIC_NUM = 17;

var pos = 0;
var separator = 0;
var mod_name = "RA3";

function int2Faction(i){
	switch(mod_name){		
		case "corona":
			switch(i){
				case "1": return "天眼帝国";
				case "2": return "帝国";
				case "3": return "Commentator";
				case "4": return "盟军";
				case "7": return "随机";
				case "8": return "苏联";
				case "9": return "神州";
				default: return "未知";
			}
		break;
		default:
			switch(i){
				case "1": return "天眼帝国";
				case "2": return "帝国";
				case "3": return "Commentator";
				case "4": return "盟军";
				case "8": return "苏联";
				default: return "未知("+i+")";
			}
		break;		
	}
}

function char2Difficulty(c){
	switch(c){
		case "E": return "简单";
		case "M": return "中等";
		case "H": return "困难";
		case "B": return "冷酷";
		default: return "未知战力";
	}
}

function revertUTF8(szInput) {
	var x,wch,wch1,wch2,uch="",szRet="";
	for (x=0; x<szInput.length; x++) {
		if (szInput.charAt(x)=="%") {
			wch =parseInt(szInput.charAt(++x) + szInput.charAt(++x),16);
			if (!wch) {break;}
			if (!(wch & 0x80)) {
				wch = wch;
			} else if (!(wch & 0x20)) {
				x++;
				wch1 = parseInt(szInput.charAt(++x) + szInput.charAt(++x),16);
				wch  = (wch & 0x1F)<< 6;
				wch1 = wch1 & 0x3F;
				wch  = wch + wch1;
			} else {
				x++;
				wch1 = parseInt(szInput.charAt(++x) + szInput.charAt(++x),16);
				x++;
				wch2 = parseInt(szInput.charAt(++x) + szInput.charAt(++x),16);
				wch  = (wch & 0x0F)<< 12;
				wch1 = (wch1 & 0x3F)<< 6;
				wch2 = (wch2 & 0x3F);
				wch  = wch + wch1 + wch2;
			}
			szRet += String.fromCharCode(wch);
		} else {
			szRet += szInput.charAt(x);
		}
	}
	return(szRet);
}

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function Uint16ToUnicode(input){
	var str = input.toString(16);
	return '\\u'+str;
}

function ReadStr(ab, len){
	var str = ab2str(new Uint8Array(ab, pos, len));
	pos += len;
	return str;
}

// 直到遇到分隔符
function ReadStrBySep(ab){
	var uarray = new Uint8Array(ab, pos);
	var i = 0;
	for (i=0;i<uarray.byteLength-1;i++){
		if ((uarray[i] == separator) && (uarray[i+1] == separator))
			break;
	}
	if(i%2 != 0)
		i += 1;
	
	new_ab = ab.slice(pos, pos + i);
	ret = new TextDecoder('unicode', {fatal: true}).decode(new_ab);

	pos += (i + 2);
	return ret;
}

// 直到遇到分隔符
function ReadStrBySepN(ab, len){
	var uarray =  new Uint8Array(ab, pos, len);
	var i = 0;
	for (i=0;i<uarray.byteLength;i += 2){
		if ((uarray[i] == separator) && (uarray[i+1] == separator))
			break;
	}
	
	new_ab = ab.slice(pos, pos + i);
	
	if (i == uarray.byteLength){
		pos += i;
	}else{
		pos += (i+2);
	}
	
	ret = new TextDecoder('unicode', {fatal: true}).decode(new_ab);
	console.log("pos: " + pos + " i: " + i + " ret.length " + ret.length);
	return ret;
}

function ReadUint8(dv){
	var ret = dv.getUint8(pos);
	pos += 1;
	return ret;
}

function ReadUint16(dv){
	var ret = dv.getUint16(pos, true);
	pos += 2;
	return ret;
}

function ReadUint32(dv){
	var ret = dv.getUint32(pos, true);	// 使用小端
	pos += 4;
	return ret;
}

function OffsetPos(len){
	pos += len;
}

// ReadHeader(ab, replay_info["header_len"], replay_info, header);
function ReadHeader(ab, len, header){
	new_ab = ab.slice(pos, pos + len);
	var raw = new TextDecoder('ascii', {fatal: true}).decode(new_ab);
	header["raw"] = raw;
	var flags = raw.split(";");
	for (var flag of flags){
		var kv = flag.split("=");
		header[kv[0]] = kv[1];
	}
	
	var players = {};
	
	var ss = header["S"].split(":");
	var cnt = 0;
	for (var s of ss){	// 玩家信息
		var player = {}
		var infos = s.split(",");
		if (infos[0][0] == "H"){			// 是玩家
			var name = infos[0].slice(1);
			player["isPlayer"] = true;
			player["playerName"] = revertUTF8(name);
			player["faction"] = int2Faction(infos[5]);
		}else if (infos[0][0] == "C"){
			var name = infos[0].slice(1);
			player["isPlayer"] = false;
			player["playerName"] = char2Difficulty(revertUTF8(name));
			player["faction"] = int2Faction(infos[2]);
		}else{
			continue;
		}
		
		players[cnt] = player;
		cnt += 1;
	}
	// console.log(players);
	header["players"] = players;
	pos += len;
}

// 传入文件对象实现解析，返回ReplayInfo对象
function ReplayParser(ab)
{
	pos = 0;
	var replay_info = {};
	if (ab.byteLength == 0)
		return ;
	
	const dv = new DataView(ab);
	replay_info["strMagic"] = ReadStr(ab, MAGIC_NUM);	// 固定头	
	console.log(replay_info["strMagic"]);
	if (replay_info["strMagic"] != "RA3 REPLAY HEADER"){
		return -1;
	}
	
	replay_info["battleType"] = ReadUint8(dv);				// 战斗类型 0x04 == 遭遇战; 0x05 == 多人游戏;
	replay_info["verMajor"] = ReadUint32(dv);
	replay_info["verMinor"] = ReadUint32(dv);
	replay_info["buildMajor"] = ReadUint32(dv);
	replay_info["buildMinor"] = ReadUint32(dv);
	
	replay_info["hasCommentary"] = ReadUint8(dv);	// 是否有评论 0x1E(有), 0x06(无)
	replay_info["separator"] = ReadUint8(dv);		// 分隔符
	separator = replay_info["separator"];
	
	replay_info["matchTitle"] = ReadStrBySep(ab);
	replay_info["matchDescription"] = ReadStrBySep(ab);

	replay_info["matchMapName"] = ReadStrBySep(ab);
	replay_info["matchMapId"] = ReadStrBySep(ab);
	replay_info["playerCount"] = ReadUint8(dv);
	replay_info["players"] = [];
	
	for (var i=0;i<=replay_info["playerCount"];i++){
		var player_id = ReadUint32(dv);
		var player_name = ReadStrBySep(ab);
		var team_id = -1;
		if (replay_info["battleType"] == 0x05){
			team_id = ReadUint8(dv);
		}else{
			team_id = -1;
		}
		replay_info["players"][i] = {"playerId":player_id,"playerName":player_name,"teamId":team_id}
	}
	replay_info["offset"] = ReadUint32(dv);		// 到chunk的偏移
	
	replay_info["strReplLeng"] = ReadUint32(dv); // 恒为8
	replay_info["strCNCMagic"] = ReadStr(ab, 8)
	
	var raw_mod_str = ReadStr(ab, 22);
	replay_info["MOD"] = raw_mod_str;
	mod_name = raw_mod_str.split("\0")[0];
	
	replay_info["timestamp"] = ReadUint32(dv);
	replay_info["unknow1"] = ReadStr(ab, 31);
	replay_info["header_len"] = ReadUint32(dv);
	// replay_info["header"] = ReadStr(ab, replay_info["header_len"]);
	header = {};
	ReadHeader(ab, replay_info["header_len"], header);
	replay_info["header"] = header;
	
	replay_info["replay_saver"] = ReadUint8(dv);		// 录像保存者的id
	
	replay_info["unknow2"] = ReadStr(ab, 8);
	
	replay_info["filename_length"] = ReadUint32(dv);
	replay_info["filename"] = ReadStrBySepN(ab, replay_info["filename_length"] * 2);

	
	replay_info["date"] = ReadUint16(dv);
	replay_info["date2"] = ReadUint16(dv);
	replay_info["date3"] = ReadUint16(dv);
	replay_info["date4"] = ReadUint16(dv);
	replay_info["date5"] = ReadUint16(dv);
	replay_info["date6"] = ReadUint16(dv);
	replay_info["date7"] = ReadUint16(dv);
	replay_info["date8"] = ReadUint16(dv);

	
	replay_info["vermagic_len"] = ReadUint32(dv);
	replay_info["vermagic"] = ReadStr(ab, replay_info["vermagic_len"]);
	replay_info["magic_hash"] = ReadUint32(dv);
	replay_info["zero4"] = ReadStr(ab, 8);
	
	console.log(replay_info);
}

/*
class ReplayParser{
	
	constructor(ArrayBuffer ab){
		if (ab.byteLength == 0)
			return ;
		const dv = new DataView(ab);
		const header = new Uint8Array(ab, 0, 17);
		console.log(header);
	}
}
*/
