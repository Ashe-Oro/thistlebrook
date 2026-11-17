// Interface placeholder only: no prices, wallets, persistence or currency flows.
export function createEconomy(){
 const counters={buy:0,sell:0,payBill:0};
 return {counters,record(kind){if(Object.hasOwn(counters,kind))counters[kind]++;return {...counters};},reset(){for(const k of Object.keys(counters))counters[k]=0;},getWallet(){return 0;},inventory(){return [];}};
}
