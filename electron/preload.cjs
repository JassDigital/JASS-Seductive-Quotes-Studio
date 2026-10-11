const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('jassApp',Object.freeze({name:'JASS Seductive Quotes Studio',version:'1.2.0',chooseDocuments:()=>ipcRenderer.invoke('collector:choose'),listQuotes:()=>ipcRenderer.invoke('quotes:list'),saveQuotes:rows=>ipcRenderer.invoke('quotes:save',rows),deleteQuote:id=>ipcRenderer.invoke('quotes:delete',id)}));
