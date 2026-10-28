function splitPgn(text){
  text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const parts=[];let start=0,i=0,depth=0,hasMoves=false;
  while(i<text.length){const c=text[i];
    if(c==='{' ){const end=text.indexOf('}',i+1);if(end<0)throw Error('Comentário sem fechamento.');i=end+1;continue}
    if(c===';'||(c==='%'&&(i===0||text[i-1]==='\n'))){const end=text.indexOf('\n',i);i=end<0?text.length:end+1;continue}
    if(c==='('){depth++;i++;continue}if(c===')'){if(!depth)throw Error('Variante com parênteses inválidos.');depth--;i++;continue}
    if(c==='['&&!depth){const tag=text.slice(i).match(/^\[\s*[A-Za-z0-9_]+\s+"(?:\\.|[^"\\])*"\s*\]/);if(!tag)throw Error('Cabeçalho PGN inválido.');if(hasMoves){parts.push(text.slice(start,i).trim());start=i;hasMoves=false}i+=tag[0].length;continue}
    if(/\s/.test(c)){i++;continue}
    const token=text.slice(i).match(/^[^\s{}();\[\]]+/);if(!token){i++;continue}
    i+=token[0].length;if(depth)continue;
    if(/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token[0])){parts.push(text.slice(start,i).trim());start=i;hasMoves=false}
    else if(!/^\$\d+$/.test(token[0]))hasMoves=true;
  }
  if(depth)throw Error('Variante sem fechamento.');
  if(text.slice(start).trim())parts.push(text.slice(start).trim());return parts;
}

module.exports={splitPgn};
