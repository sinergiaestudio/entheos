/** One active study contract. Pixel owners and existing renderers remain adapters.
 * No patient data is persisted or sent. Callbacks stay in memory; nothing is serialized. */
let active=null,revision=0,mode='2d',selectedView=0;
const listeners=new Set();
export const session={
 get snapshot(){return {active,revision,mode,selectedView};},
 subscribe(fn){listeners.add(fn);fn(this.snapshot);return ()=>listeners.delete(fn);},
 activate(study){if(active?.owner!==study.owner){const previous=active;active=null;previous?.release?.();}active=study;revision++;mode='2d';selectedView=0;this.notify();},
 update(patch){if(!active)return;active={...active,...patch};revision++;this.notify();},
 view(index){selectedView=index;this.notify();},
 mode(value){mode=value;this.notify();},
 clear(owner){if(owner&&active?.owner!==owner)return;const previous=active;active=null;mode='2d';selectedView=0;revision++;previous?.release?.();this.notify();},
 notify(){for(const fn of listeners)fn(this.snapshot);}
};
