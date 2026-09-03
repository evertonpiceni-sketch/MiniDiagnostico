const a = " ";
if (!a) console.log("empty");
try { JSON.parse(a); } catch (e) { console.log(e.message); }
