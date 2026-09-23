/** Owner-approved employers. Matching never uses a person's name, title or bio. */
export const TARGET_COMPANIES=['Evercore','Wells Fargo','Deutsche Bank','Citi','Nomura','HSBC','Morgan Stanley','Bank of America','BlackRock','JP Morgan','Goldman Sachs','UBS','Barclays','Fidelity','Balyasny'] as const;
const normalize=(value:string)=>value.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
const aliases:Record<string,string[]>={
 'Evercore':['Evercore Inc','Evercore ISI'],
 'Wells Fargo':['Wells Fargo Securities','Wells Fargo Bank','Wells Fargo & Company'],
 'Deutsche Bank':['Deutsche Bank AG','Deutsche Bank Securities'],
 'Citi':['Citigroup','Citibank','Citigroup Global Markets'],
 'Nomura':['Nomura Securities','Nomura Holdings','Nomura Securities International'],
 'HSBC':['HSBC Bank','HSBC Securities','HSBC Holdings'],
 'Morgan Stanley':['Morgan Stanley & Co'],
 'Bank of America':['BofA Securities','Bank of America Securities','Bank of America Merrill Lynch'],
 'BlackRock':['BlackRock Inc'],
 'JP Morgan':['J.P. Morgan','JPMorgan','JPMorgan Chase','JPMorgan Chase & Co','J.P. Morgan Securities'],
 'Goldman Sachs':['Goldman Sachs & Co','The Goldman Sachs Group'],
 'UBS':['UBS AG','UBS Securities'],
 'Barclays':['Barclays Bank','Barclays Capital'],
 'Fidelity':['Fidelity Investments','Fidelity Management & Research'],
 'Balyasny':['Balyasny Asset Management']
};
const key=(value:string)=>normalize(value.replace(/(?:[,\s]+(?:inc\.?|llc|ltd\.?|plc|corp\.?|corporation|n\.?a\.?))+$/i,''));
export function canonicalCompany(value:string){const k=key(value);return TARGET_COMPANIES.find(name=>[name,...(aliases[name]||[])].some(alias=>key(alias)===k))||'';}
export function allowedCompany(value:string){return Boolean(canonicalCompany(value));}
