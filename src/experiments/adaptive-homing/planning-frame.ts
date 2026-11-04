import { VALIDATION_LIMITS as L } from '../../core/field-validator-types.ts';
import type { ValidationBudget } from '../../core/field-validator-types.ts';

/** Bounded homing planning accounting. Two ordinary 120Hz allowances per RAF.
 * No wall-clock decisions, future roots, new jobs or extra search attempts.
 */
export class HomingPlanningFrame {
 private enabled=false;
 private propagations=0;private queries=0;private chunks=0;private ms=0;private deferred=0;
 readonly limit=Object.freeze({propagations:2*L.defaultPropagationsPerTick,narrowQueries:2*L.defaultQueriesPerTick});
 latest={propagations:0,queries:0,chunks:0,ms:0,deferred:0,frameMs:0};
 maxMs=0;maxFrameMs=0;spikes=0;
 begin():void{this.enabled=true;}
 budget(publication:boolean):ValidationBudget {
  if(!this.enabled)return{propagations:L.defaultPropagationsPerTick,narrowQueries:L.defaultQueriesPerTick};
  const p=this.limit.propagations-this.propagations,q=this.limit.narrowQueries-this.queries;
  // An actual-root gate must receive its entire existing allowance. Otherwise
  // wait for another RAF, or explicitly fail closed at the simulation deadline.
  if(publication&&(p<L.defaultPropagationsPerTick||q<L.defaultQueriesPerTick))return{propagations:0,narrowQueries:0};
  return{propagations:Math.min(p,L.defaultPropagationsPerTick),narrowQueries:Math.min(q,L.defaultQueriesPerTick)};
 }
 spent(p:number,q:number,ms:number):void{if(this.enabled){this.propagations+=p;this.queries+=q;this.ms+=ms;this.chunks++;}}
 defer():void{if(this.enabled)this.deferred++;}
 finish(dt:number):void{
  const sample=this.latest;sample.propagations=this.propagations;sample.queries=this.queries;sample.chunks=this.chunks;sample.ms=this.ms;sample.deferred=this.deferred;sample.frameMs=dt*1000;
  this.maxMs=Math.max(this.maxMs,this.ms);this.maxFrameMs=Math.max(this.maxFrameMs,dt*1000);if(dt>.03)this.spikes++;
  this.propagations=this.queries=this.chunks=this.ms=this.deferred=0;this.enabled=false;
 }
 reset():void{this.enabled=false;this.propagations=this.queries=this.chunks=this.ms=this.deferred=0;this.maxMs=this.maxFrameMs=this.spikes=0;this.latest={propagations:0,queries:0,chunks:0,ms:0,deferred:0,frameMs:0};}
}
