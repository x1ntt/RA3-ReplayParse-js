
// By · x1nt
// https://github.com/x1ntt/RA3-ReplayParse-js
// 2022.06.22

class ReplayParser{
	// 传入文件对象实现解析，返回ReplayInfo对象
	constructor(ab){
		this._MAGIC_NUM = 17;
		this._ab = ab;
		
		this._pos = 0;
		this._separator = 0;
		this._mod_name = "RA3";

		this.OnSuccess = null;
		this.OnFail = null;
	}
	
	int2Faction(i){
		switch(this._mod_name){		
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

	char2Difficulty(c){
		switch(c){
			case "E": return "简单";
			case "M": return "中等";
			case "H": return "困难";
			case "B": return "冷酷";
			default: return "未知战力("+c+")";
		}
	}

	revertUTF8(szInput) {
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

	ab2str(buf) {
	  return String.fromCharCode.apply(null, new Uint8Array(buf));
	}

	Uint16ToUnicode(input){
		var str = input.toString(16);
		return '\\u'+str;
	}

	ReadStr(ab, len){
		var str = this.ab2str(new Uint8Array(ab, this._pos, len));
		this._pos += len;
		return str;
	}

	// 直到遇到分隔符
	ReadStrBySep(ab){
		var uarray = new Uint8Array(ab, this._pos);
		var i = 0;
		for (i=0;i<uarray.byteLength-1;i++){
			if ((uarray[i] == this._separator) && (uarray[i+1] == this._separator))
				break;
		}
		if(i%2 != 0)
			i += 1;
		
		var newab = ab.slice(this._pos, this._pos + i);
		var ret = new TextDecoder('unicode', {fatal: true}).decode(newab);

		this._pos += (i + 2);
		return ret;
	}

	// 直到遇到分隔符
	ReadStrBySepN(ab, len){
		var uarray =  new Uint8Array(ab, this._pos, len);
		var i = 0;
		for (i=0;i<uarray.byteLength;i += 2){
			if ((uarray[i] == this._separator) && (uarray[i+1] == this._separator))
				break;
		}
		
		var newab = ab.slice(this._pos, this._pos + i);
		
		if (i == uarray.byteLength){
			this._pos += i;
		}else{
			this._pos += (i+2);
		}
		
		var ret = new TextDecoder('unicode', {fatal: true}).decode(newab);
		console.log("this._pos: " + this._pos + " i: " + i + " ret.length " + ret.length);
		return ret;
	}

	ReadUint8(dv){
		var ret = dv.getUint8(this._pos);
		this._pos += 1;
		return ret;
	}

	ReadUint16(dv){
		var ret = dv.getUint16(this._pos, true);
		this._pos += 2;
		return ret;
	}

	ReadUint32(dv){
		var ret = dv.getUint32(this._pos, true);	// 使用小端
		this._pos += 4;
		return ret;
	}

	// ReadHeader(ab, replay_info["header_len"], replay_info, header);
	ReadHeader(ab, len, header){
		var newab = ab.slice(this._pos, this._pos + len);
		var raw = new TextDecoder('ascii', {fatal: true}).decode(newab);
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
				player["playerName"] = this.revertUTF8(name);
				player["faction"] = this.int2Faction(infos[5]);
			}else if (infos[0][0] == "C"){
				var name = infos[0].slice(1);
				player["isPlayer"] = false;
				player["playerName"] = this.char2Difficulty(this.revertUTF8(name));
				player["faction"] = this.int2Faction(infos[2]);
			}else{
				continue;
			}
			
			players[cnt] = player;
			cnt += 1;
		}
		// console.log(players);
		header["players"] = players;
		this._pos += len;
	}
	
	Parse()
	{
		this._pos = 0;
		var replay_info = {};
		if (this._ab.byteLength == 0)
		{
			this.OnFail("没有载入录像文件");
			return ;
		}
		
		const dv = new DataView(this._ab);
		replay_info["strMagic"] = this.ReadStr(this._ab, this._MAGIC_NUM);	// 固定头	
		console.log(replay_info["strMagic"]);
		if (replay_info["strMagic"] != "RA3 REPLAY HEADER"){
			this.OnFail("这不是一个正常的录像文件");
			return -1;
		}
		
		replay_info["battleType"] = this.ReadUint8(dv);				// 战斗类型 0x04 == 遭遇战; 0x05 == 多人游戏;
		replay_info["verMajor"] = this.ReadUint32(dv);
		replay_info["verMinor"] = this.ReadUint32(dv);
		replay_info["buildMajor"] = this.ReadUint32(dv);
		replay_info["buildMinor"] = this.ReadUint32(dv);
		
		replay_info["hasCommentary"] = this.ReadUint8(dv);	// 是否有评论 0x1E(有), 0x06(无)
		replay_info["separator"] = this.ReadUint8(dv);		// 分隔符
		this._separator = replay_info["separator"];
		
		replay_info["matchTitle"] = this.ReadStrBySep(this._ab);
		replay_info["matchDescription"] = this.ReadStrBySep(this._ab);

		replay_info["matchMapName"] = this.ReadStrBySep(this._ab);
		replay_info["matchMapId"] = this.ReadStrBySep(this._ab);
		replay_info["playerCount"] = this.ReadUint8(dv);
		replay_info["players"] = [];
		
		for (var i=0;i<=replay_info["playerCount"];i++){
			var player_id = this.ReadUint32(dv);
			var player_name = this.ReadStrBySep(this._ab);
			var team_id = -1;
			if (replay_info["battleType"] == 0x05){
				team_id = this.ReadUint8(dv);
			}else{
				team_id = -1;
			}
			replay_info["players"][i] = {"playerId":player_id,"playerName":player_name,"teamId":team_id}
		}
		replay_info["offset"] = this.ReadUint32(dv);		// 到chunk的偏移
		
		replay_info["strReplLeng"] = this.ReadUint32(dv); // 恒为8
		replay_info["strCNCMagic"] = this.ReadStr(this._ab, 8)
		
		var raw_mod_str = this.ReadStr(this._ab, 22);
		replay_info["MOD"] = raw_mod_str;
		this._mod_name = raw_mod_str.split("\0")[0];
		
		replay_info["timestamp"] = this.ReadUint32(dv);
		replay_info["unknow1"] = this.ReadStr(this._ab, 31);
		replay_info["header_len"] = this.ReadUint32(dv);
		
		var header = {};
		this.ReadHeader(this._ab, replay_info["header_len"], header);
		replay_info["header"] = header;
		
		replay_info["replay_saver"] = this.ReadUint8(dv);		// 录像保存者的id
		
		replay_info["unknow2"] = this.ReadStr(this._ab, 8);
		
		replay_info["filename_length"] = this.ReadUint32(dv);
		replay_info["filename"] = this.ReadStrBySepN(this._ab, replay_info["filename_length"] * 2);

		
		replay_info["date"] = this.ReadUint16(dv);
		replay_info["date2"] = this.ReadUint16(dv);
		replay_info["date3"] = this.ReadUint16(dv);
		replay_info["date4"] = this.ReadUint16(dv);
		replay_info["date5"] = this.ReadUint16(dv);
		replay_info["date6"] = this.ReadUint16(dv);
		replay_info["date7"] = this.ReadUint16(dv);
		replay_info["date8"] = this.ReadUint16(dv);

		
		replay_info["vermagic_len"] = this.ReadUint32(dv);
		replay_info["vermagic"] = this.ReadStr(this._ab, replay_info["vermagic_len"]);
		replay_info["magic_hash"] = this.ReadUint32(dv);
		replay_info["zero4"] = this.ReadStr(this._ab, 8);
		
		this.OnSuccess(replay_info);
		// console.log(replay_info);
	}
}
