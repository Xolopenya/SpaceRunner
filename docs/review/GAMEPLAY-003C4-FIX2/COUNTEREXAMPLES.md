# Frozen actual-root counterexamples

Исходный ZIP SHA-256: `58f953530be8920935f469f82765f7d83aa8d96f95f64cb16b30bfc3bb4c961a`. Все18 записей сохранены целиком в tests/fixtures/homing-route-counterexamples.json:15 NO_WITNESS_FOUND и3 held-prefix отказа. Полная геометрия, original hint, root и motion metadata неизменны. Original geometry воспроизводит каждое отклонение точно. Ни offline full-beam inputs, ни fixture tapes не импортируются игрой.

## 0: seed0, witness

Root: {"player":{"x":-3.1583719621561395,"y":-0.022771469799776685,"vx":-5.390187582825713,"vy":5.448520916159047},"input":{"x":1,"y":0},"elapsed":77.0750000000074,"distance":1888.069878472217}.

Committed: structure-mixed-v2/0/78/left [kind5,XY0,0,depth1932,radius13]; ambient-v1/0/5.4:3.15:6:0.3:12/79/0 [kind0,XY2.7510140187107037,-0.6072333522140978,depth1900.6144257327542,radius0.8386881469632499]; ambient-v1/0/5.4:3.15:6:0.3:12/81/1 [kind0,XY0.6294254986569285,-0.10051648209337127,depth1964.8641122002155,radius0.7599908399861306].

Mine initial: {"id":"adaptive-homing-v1/0/84/9249/0a7daba1","tick":9249,"x":4.5,"y":2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":-3.1583719621561395,"targetY":-0.022771469799776685,"phase":"waiting"}. Original: NO_WITNESS_FOUND / structure-mixed-v2/0/78/left@170; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash 94732b9b, propagation/query 1785/597. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 1: seed0, horizontal

Root: {"player":{"x":-3.966666666666666,"y":0,"vx":-8,"vy":0},"input":{"x":-1,"y":0},"elapsed":17.874999999999627,"distance":376.1471006944444}.

Committed: structure-mixed-v2/0/15/lower [kind8,XY0,0,depth420,radius13]; ambient-v1/0/5.4:3.15:6:0.3:12/15/1 [kind0,XY-4.229284686874599,-3.000600069807842,depth381.4983216393739,radius0.7575736664352007]; ambient-v1/0/5.4:3.15:6:0.3:12/18/1 [kind2,XY3.952271011378617,-0.9013963596895338,depth453.53084825724363,radius0.8829725719871931].

Mine initial: {"id":"adaptive-homing-v1/0/21/2145/7eebc690","tick":2145,"x":-4.5,"y":-2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":-3.966666666666666,"targetY":0,"phase":"waiting"}. Original: NO_WITNESS_FOUND / structure-mixed-v2/0/15/lower@221; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash 44212496, propagation/query 2307/795. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 2: seed0, horizontal

Root: {"player":{"x":3.504444444444463,"y":0,"vx":-5.8666666666666645,"vy":0},"input":{"x":-1,"y":0},"elapsed":49.93333333333114,"distance":1144.1356435185141}.

Committed: structure-mixed-v2/0/47/center [kind4,XY0,0,depth1188,radius13]; ambient-v1/0/5.4:3.15:6:0.3:12/48/0 [kind0,XY-1.2853302416391674,-1.9663760245777666,depth1153.4235065924004,radius1.0560655658482574]; ambient-v1/0/5.4:3.15:6:0.3:12/50/1 [kind1,XY-4.294473480340094,2.8464747574646023,depth1219.5614549210295,radius0.9809212140389718].

Mine initial: {"id":"adaptive-homing-v1/0/53/5992/177ac8f9","tick":5992,"x":4.5,"y":2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":3.504444444444463,"targetY":0,"phase":"waiting"}. Original: NO_WITNESS_FOUND / structure-mixed-v2/0/47/center@189; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash 539188e2, propagation/query 1991/687. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 3: seed0, boundary

Root: {"player":{"x":6,"y":3.6,"vx":0,"vy":0},"input":{"x":1,"y":1},"elapsed":17.874999999999627,"distance":376.1471006944444}.

Committed: structure-mixed-v2/0/15/lower [kind8,XY0,0,depth420,radius13]; ambient-v1/0/5.4:3.15:6:0.3:12/15/1 [kind0,XY-4.229284686874599,-3.000600069807842,depth381.4983216393739,radius0.7575736664352007]; ambient-v1/0/5.4:3.15:6:0.3:12/18/1 [kind2,XY3.952271011378617,-0.9013963596895338,depth453.53084825724363,radius0.8829725719871931].

Mine initial: {"id":"adaptive-homing-v1/0/21/2145/98322b07","tick":2145,"x":-4.5,"y":-2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":6,"targetY":3.6,"phase":"waiting"}. Original: NO_WITNESS_FOUND / structure-mixed-v2/0/15/lower@222; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash 44143ab6, propagation/query 2307/795. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 4: seed0, late-reversal

Root: {"player":{"x":1.7864583333333348,"y":0,"vx":0,"vy":0},"input":{"x":0,"y":0},"elapsed":32.516666666665465,"distance":712.0269340277763}.

Committed: encounter-v1/0/5.4:3.15:6:0.3:12/vertical-weave:27:4:10:0.65:1:0:4.291810661340133:2.4579222198575734/30/4 [kind0,XY5.288550284160301,3.026653302423656,depth728.7346790822409,radius0.8050278323586099]; encounter-v1/0/5.4:3.15:6:0.3:12/vertical-weave:27:4:10:0.65:1:0:4.291810661340133:2.4579222198575734/30/5 [kind0,XY3.3309730373881763,3.12,depth731.6264623462595,radius0.8774655397050083]; ambient-v1/0/5.4:3.15:6:0.3:12/32/0 [kind2,XY-3.6120059036649765,1.1799294278025623,depth772.8324302695692,radius0.7691458064015024]; ambient-v1/0/5.4:3.15:6:0.3:12/33/0 [kind2,XY-1.8392751725390553,1.3083953957771883,depth796.1669245334342,radius0.7845274466555566].

Mine initial: {"id":"adaptive-homing-v1/0/35/3902/432835a6","tick":3902,"x":4.5,"y":2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":1.7864583333333348,"targetY":0,"phase":"waiting"}. Original: NO_WITNESS_FOUND / adaptive-homing-v1/0/35/3902/432835a6@1038; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash d9ea734c, propagation/query 2151/279. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 5: seed11, witness

Root: {"player":{"x":6,"y":-3.6,"vx":0,"vy":0},"input":{"x":0,"y":-1},"elapsed":111.89166666670178,"distance":2968.206187500081}.

Committed: ambient-v1/11/5.4:3.15:6:0.3:12/127/0 [kind2,XY2.034014764521271,0.335678510600701,depth3052.9869776638225,radius0.8578632757649758]; ambient-v1/11/5.4:3.15:6:0.3:12/127/1 [kind0,XY2.6526389035396285,0.4202615699730812,depth3067.7340204846114,radius0.730499119439628].

Mine initial: {"id":"adaptive-homing-v1/11/129/13427/0cc72e02","tick":13427,"x":4.5,"y":-2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":6,"targetY":-3.6,"phase":"waiting"}. Original: NO_WITNESS_FOUND / adaptive-homing-v1/11/129/13427/0cc72e02@758; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash b862e153, propagation/query 1575/207. Previous full-beam recovery=false. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 6: seed11, touch

Root: {"player":{"x":-3.9205971664364165,"y":3.073555302558182,"vx":3.0546677585700754,"vy":-2.133800328124439},"input":{"x":0.38183346982125943,"y":-0.2667250410155549},"elapsed":10.1083333333334,"distance":208.1319872685186}.

Committed: encounter-v1/11/5.4:3.15:6:0.3:12/scattered:7:2:2:0.35:1:1:-2.375916941880325:-1.235609759021613/8/3 [kind2,XY-5.1603536101962275,-2.773674902230564,depth210.69692321819252,radius0.7946038262802176]; encounter-v1/11/5.4:3.15:6:0.3:12/narrowing:10:3:4:0.65:0:0:-2.718524305364117:2.6677488386515966/10/0 [kind0,XY-5.37,2.7101329730265156,depth247.90891405574976,radius0.7621838349150494]; encounter-v1/11/5.4:3.15:6:0.3:12/narrowing:10:3:4:0.65:0:0:-2.718524305364117:2.6677488386515966/10/1 [kind0,XY0.4034564881399274,2.538391475422741,depth250.72392156671734,radius1.039746127568651]; encounter-v1/11/5.4:3.15:6:0.3:12/narrowing:10:3:4:0.65:0:0:-2.718524305364117:2.6677488386515966/11/2 [kind0,XY-5.120462026925137,3.12,depth264.51480934858944,radius0.9070592496078461]; encounter-v1/11/5.4:3.15:6:0.3:12/narrowing:10:3:4:0.65:0:0:-2.718524305364117:2.6677488386515966/11/3 [kind1,XY-0.0988581775563464,2.8507167360668086,depth267.32860694442564,radius0.8346215422614478]; encounter-v1/11/5.4:3.15:6:0.3:12/narrowing:10:3:4:0.65:0:0:-2.718524305364117:2.6677488386515966/11/4 [kind0,XY-4.925436050208907,3.040572851867405,depth281.7024390190964,radius0.7019346643006429]; encounter-v1/11/5.4:3.15:6:0.3:12/narrowing:10:3:4:0.65:0:0:-2.718524305364117:2.6677488386515966/11/5 [kind2,XY-0.6647862131645281,2.9295478144526417,depth284.6247821425398,radius0.9794969569542445]; encounter-v1/11/5.4:3.15:6:0.3:12/narrowing:10:3:4:0.65:0:0:-2.718524305364117:2.6677488386515966/12/6 [kind0,XY-4.605167993251234,2.8273594066383736,depth297.66720080638305,radius0.8468100789934396]; encounter-v1/11/5.4:3.15:6:0.3:12/narrowing:10:3:4:0.65:0:0:-2.718524305364117:2.6677488386515966/12/7 [kind0,XY-1.2795575465820732,2.5384027967812806,depth300.6060242143087,radius0.7743723716470413].

Mine initial: {"id":"adaptive-homing-v1/11/14/1213/1aea7403","tick":1213,"x":-4.5,"y":-2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":-3.9205971664364165,"targetY":3.073555302558182,"phase":"waiting"}. Original: NO_WITNESS_FOUND / encounter-v1/11/5.4:3.15:6:0.3:12/narrowing:10:3:4:0.65:0:0:-2.718524305364117:2.6677488386515966/12/7@515; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash 52dcc924, propagation/query 2399/621. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 7: seed11, late-reversal

Root: {"player":{"x":1.6531250000000015,"y":0,"vx":0,"vy":0},"input":{"x":0,"y":0},"elapsed":28.441666666665693,"distance":616.0346493055547}.

Committed: encounter-v1/11/5.4:3.15:6:0.3:12/alternating:26:4:10:0.65:1:0:-4.51163839833811:-2.20445299172774/26/0 [kind0,XY-5.359480149708689,-2.9915965652279555,depth632.5444714333489,radius0.9627909759990871]; encounter-v1/11/5.4:3.15:6:0.3:12/alternating:26:4:10:0.65:1:0:-4.51163839833811:-2.20445299172774/26/1 [kind1,XY-5.212369489017874,-1.3740829428285362,depth635.3593543625623,radius0.8903532686526887]; encounter-v1/11/5.4:3.15:6:0.3:12/alternating:26:4:10:0.65:1:0:-4.51163839833811:-2.20445299172774/27/2 [kind0,XY-3.7517765174992386,-3.12,depth668.2947609147616,radius0.8179155613062903]; encounter-v1/11/5.4:3.15:6:0.3:12/alternating:26:4:10:0.65:1:0:-4.51163839833811:-2.20445299172774/27/3 [kind0,XY-3.767237401977182,-1.4212643516249956,depth671.118168517705,radius0.7454778539598919]; encounter-v1/11/5.4:3.15:6:0.3:12/alternating:26:4:10:0.65:1:0:-4.51163839833811:-2.20445299172774/29/4 [kind0,XY-5.37,-3.0777904195524752,depth705.3166812948137,radius1.0230401466134935]; encounter-v1/11/5.4:3.15:6:0.3:12/alternating:26:4:10:0.65:1:0:-4.51163839833811:-2.20445299172774/29/5 [kind2,XY-5.29035340083763,-1.3632611634209755,depth708.2833894848451,radius0.9506024392670952].

Mine initial: {"id":"adaptive-homing-v1/11/31/3413/1ee8a313","tick":3413,"x":4.5,"y":2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":1.6531250000000015,"targetY":0,"phase":"waiting"}. Original: NO_WITNESS_FOUND / adaptive-homing-v1/11/31/3413/1ee8a313@1059; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash 54bde3d4, propagation/query 2193/438. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 8: seed42, witness

Root: {"player":{"x":-6,"y":0,"vx":0,"vy":0},"input":{"x":-1,"y":0},"elapsed":31.508333333332185,"distance":688.0938622685172}.

Committed: ambient-v1/42/5.4:3.15:6:0.3:12/28/1 [kind0,XY-0.7162697872146966,-1.1771838375600054,depth692.0199641156942,radius0.9292866900563241]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/31/0 [kind0,XY3.9176917533891764,-0.8831099878322073,depth749.0463873061537,radius1.0119408598169684]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/31/1 [kind2,XY3.9667364170810697,-2.8788511455781496,depth763.5605976205039,radius0.93950315247057]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/32/2 [kind2,XY1.9486430781463655,-1.924078509609748,depth772.2233295516484,radius0.8670654451241717]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/32/3 [kind1,XY2.5773456432892496,-1.8506686819508413,depth786.5610066321027,radius0.7946277377777733].

Mine initial: {"id":"adaptive-homing-v1/42/34/3781/33d444c0","tick":3781,"x":-4.5,"y":2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":-6,"targetY":0,"phase":"waiting"}. Original: NO_WITNESS_FOUND / adaptive-homing-v1/42/34/3781/33d444c0@1043; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash 87802094, propagation/query 2161/336. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 9: seed42, witness

Root: {"player":{"x":6,"y":-0.0940385955033803,"vx":0,"vy":0},"input":{"x":1,"y":0},"elapsed":59.92499999999724,"distance":1408.0044583333263}.

Committed: encounter-v1/42/5.4:3.15:6:0.3:12/vertical-weave:56:4:22:0.65:1:0:4.292564980844036:2.423062635883689/59/4 [kind0,XY5.37,3.0681250464171175,depth1424.813023181334,radius0.9535562882665545]; encounter-v1/42/5.4:3.15:6:0.3:12/vertical-weave:56:4:22:0.65:1:0:4.292564980844036:2.423062635883689/59/5 [kind1,XY3.18360595731996,3.063238641284406,depth1427.6095196556673,radius0.881118580920156]; ambient-v1/42/5.4:3.15:6:0.3:12/61/0 [kind2,XY-0.052098704036325216,-2.2433844752144068,depth1467.99377087038,radius0.835258712025825]; ambient-v1/42/5.4:3.15:6:0.3:12/62/0 [kind0,XY1.6026488634757703,-1.3714101844467221,depth1489.0236206967384,radius0.6571401463239454]; ambient-v1/42/5.4:3.15:6:0.3:12/62/1 [kind2,XY0.695727035030723,-2.80436413816642,depth1511.1144837141037,radius1.0085819120286033].

Mine initial: {"id":"adaptive-homing-v1/42/64/7191/75917fab","tick":7191,"x":4.5,"y":-2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":6,"targetY":-0.0940385955033803,"phase":"waiting"}. Original: NO_WITNESS_FOUND / adaptive-homing-v1/42/64/7191/75917fab@925; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash ad275712, propagation/query 1911/345. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 10: seed42, witness

Root: {"player":{"x":3.9720626617883834,"y":3.6,"vx":0,"vy":0},"input":{"x":0,"y":1},"elapsed":99.26666666669173,"distance":2560.190736111148}.

Committed: ambient-v1/42/5.4:3.15:6:0.3:12/106/1 [kind2,XY3.9697335247881718,1.4261812466662378,depth2567.0076385829598,radius0.8912025248748251]; ambient-v1/42/5.4:3.15:6:0.3:12/110/0 [kind0,XY1.5629941726103427,0.5977406966267154,depth2645.9906846014783,radius1.0978772008791566]; ambient-v1/42/5.4:3.15:6:0.3:12/110/1 [kind2,XY1.3768451345153156,1.923286873614415,depth2659.88927449286,radius1.0871808045660147].

Mine initial: {"id":"adaptive-homing-v1/42/112/11912/e7b68e54","tick":11912,"x":4.5,"y":2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":3.9720626617883834,"targetY":3.6,"phase":"waiting"}. Original: NO_WITNESS_FOUND / adaptive-homing-v1/42/112/11912/e7b68e54@791; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash 3586466c, propagation/query 1645/237. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 11: seed42, neutral

Root: {"player":{"x":0,"y":0,"vx":0,"vy":0},"input":{"x":0,"y":0},"elapsed":31.508333333332185,"distance":688.0938622685172}.

Committed: ambient-v1/42/5.4:3.15:6:0.3:12/28/1 [kind0,XY-0.7162697872146966,-1.1771838375600054,depth692.0199641156942,radius0.9292866900563241]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/31/0 [kind0,XY3.9176917533891764,-0.8831099878322073,depth749.0463873061537,radius1.0119408598169684]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/31/1 [kind2,XY3.9667364170810697,-2.8788511455781496,depth763.5605976205039,radius0.93950315247057]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/32/2 [kind2,XY1.9486430781463655,-1.924078509609748,depth772.2233295516484,radius0.8670654451241717]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/32/3 [kind1,XY2.5773456432892496,-1.8506686819508413,depth786.5610066321027,radius0.7946277377777733].

Mine initial: {"id":"adaptive-homing-v1/42/34/3781/ae21a17b","tick":3781,"x":-4.5,"y":2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":0,"targetY":0,"phase":"waiting"}. Original: INSUFFICIENT_REACTION_DISTANCE / ambient-v1/42/5.4:3.15:6:0.3:12/28/1@17; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **reject**, independent replay **not applicable**, hash none, propagation/query 17/5. Previous full-beam recovery=false. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 12: seed42, neutral

Root: {"player":{"x":0,"y":0,"vx":0,"vy":0},"input":{"x":0,"y":0},"elapsed":47.12499999999797,"distance":1072.0675694444406}.

Committed: structure-mixed-v2/42/44/right [kind6,XY0,0,depth1116,radius13]; ambient-v1/42/5.4:3.15:6:0.3:12/44/1 [kind0,XY0.14053093660622817,1.520626676897518,depth1077.4293854087591,radius1.0968993621878327]; ambient-v1/42/5.4:3.15:6:0.3:12/47/1 [kind1,XY4.231871891207993,-1.9196058633970097,depth1149.5969473086298,radius0.6776755229569972].

Mine initial: {"id":"adaptive-homing-v1/42/50/5655/edbba09f","tick":5655,"x":-4.5,"y":-2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":0,"targetY":0,"phase":"waiting"}. Original: INSUFFICIENT_REACTION_DISTANCE / ambient-v1/42/5.4:3.15:6:0.3:12/44/1@23; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **reject**, independent replay **not applicable**, hash none, propagation/query 23/6. Previous full-beam recovery=false. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 13: seed42, horizontal

Root: {"player":{"x":2.0333333333333483,"y":0,"vx":-8,"vy":0},"input":{"x":-1,"y":0},"elapsed":47.12499999999797,"distance":1072.0675694444406}.

Committed: structure-mixed-v2/42/44/right [kind6,XY0,0,depth1116,radius13]; ambient-v1/42/5.4:3.15:6:0.3:12/44/1 [kind0,XY0.14053093660622817,1.520626676897518,depth1077.4293854087591,radius1.0968993621878327]; ambient-v1/42/5.4:3.15:6:0.3:12/47/1 [kind1,XY4.231871891207993,-1.9196058633970097,depth1149.5969473086298,radius0.6776755229569972].

Mine initial: {"id":"adaptive-homing-v1/42/50/5655/686a4543","tick":5655,"x":-4.5,"y":-2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":2.0333333333333483,"targetY":0,"phase":"waiting"}. Original: INSUFFICIENT_REACTION_DISTANCE / ambient-v1/42/5.4:3.15:6:0.3:12/44/1@23; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **reject**, independent replay **not applicable**, hash none, propagation/query 23/6. Previous full-beam recovery=false. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 14: seed42, touch

Root: {"player":{"x":5.620531500365423,"y":3.6,"vx":1.3212360401365915,"vy":0},"input":{"x":0.16515450501707393,"y":0.5849306662689201},"elapsed":31.508333333332185,"distance":688.0938622685172}.

Committed: ambient-v1/42/5.4:3.15:6:0.3:12/28/1 [kind0,XY-0.7162697872146966,-1.1771838375600054,depth692.0199641156942,radius0.9292866900563241]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/31/0 [kind0,XY3.9176917533891764,-0.8831099878322073,depth749.0463873061537,radius1.0119408598169684]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/31/1 [kind2,XY3.9667364170810697,-2.8788511455781496,depth763.5605976205039,radius0.93950315247057]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/32/2 [kind2,XY1.9486430781463655,-1.924078509609748,depth772.2233295516484,radius0.8670654451241717]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/32/3 [kind1,XY2.5773456432892496,-1.8506686819508413,depth786.5610066321027,radius0.7946277377777733].

Mine initial: {"id":"adaptive-homing-v1/42/34/3781/6bd819d5","tick":3781,"x":-4.5,"y":2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":5.620531500365423,"targetY":3.6,"phase":"waiting"}. Original: NO_WITNESS_FOUND / adaptive-homing-v1/42/34/3781/6bd819d5@1047; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash b975e787, propagation/query 2161/336. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 15: seed42, touch

Root: {"player":{"x":3.027041488421732,"y":3.6,"vx":-6.07689516462945,"vy":0},"input":{"x":-0.7596118955786813,"y":0.505707221578081},"elapsed":47.12499999999797,"distance":1072.0675694444406}.

Committed: structure-mixed-v2/42/44/right [kind6,XY0,0,depth1116,radius13]; ambient-v1/42/5.4:3.15:6:0.3:12/44/1 [kind0,XY0.14053093660622817,1.520626676897518,depth1077.4293854087591,radius1.0968993621878327]; ambient-v1/42/5.4:3.15:6:0.3:12/47/1 [kind1,XY4.231871891207993,-1.9196058633970097,depth1149.5969473086298,radius0.6776755229569972].

Mine initial: {"id":"adaptive-homing-v1/42/50/5655/8d23406d","tick":5655,"x":-4.5,"y":-2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":3.027041488421732,"targetY":3.6,"phase":"waiting"}. Original: NO_WITNESS_FOUND / structure-mixed-v2/42/44/right@192; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash 0a198da0, propagation/query 2015/594. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 16: seed42, early-reversal

Root: {"player":{"x":-6,"y":0,"vx":0,"vy":0},"input":{"x":0,"y":0},"elapsed":31.508333333332185,"distance":688.0938622685172}.

Committed: ambient-v1/42/5.4:3.15:6:0.3:12/28/1 [kind0,XY-0.7162697872146966,-1.1771838375600054,depth692.0199641156942,radius0.9292866900563241]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/31/0 [kind0,XY3.9176917533891764,-0.8831099878322073,depth749.0463873061537,radius1.0119408598169684]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/31/1 [kind2,XY3.9667364170810697,-2.8788511455781496,depth763.5605976205039,radius0.93950315247057]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/32/2 [kind2,XY1.9486430781463655,-1.924078509609748,depth772.2233295516484,radius0.8670654451241717]; encounter-v1/42/5.4:3.15:6:0.3:12/scattered:31:2:12:0.35:1:1:3.1771816671396165:-1.1618539320096115/32/3 [kind1,XY2.5773456432892496,-1.8506686819508413,depth786.5610066321027,radius0.7946277377777733].

Mine initial: {"id":"adaptive-homing-v1/42/34/3781/ba032bac","tick":3781,"x":-4.5,"y":2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":-6,"targetY":0,"phase":"waiting"}. Original: NO_WITNESS_FOUND / adaptive-homing-v1/42/34/3781/ba032bac@1043; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash ff8158aa, propagation/query 2161/336. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.

## 17: seed42, early-reversal

Root: {"player":{"x":-6,"y":0,"vx":0,"vy":0},"input":{"x":0,"y":0},"elapsed":47.12499999999797,"distance":1072.0675694444406}.

Committed: structure-mixed-v2/42/44/right [kind6,XY0,0,depth1116,radius13]; ambient-v1/42/5.4:3.15:6:0.3:12/44/1 [kind0,XY0.14053093660622817,1.520626676897518,depth1077.4293854087591,radius1.0968993621878327]; ambient-v1/42/5.4:3.15:6:0.3:12/47/1 [kind1,XY4.231871891207993,-1.9196058633970097,depth1149.5969473086298,radius0.6776755229569972].

Mine initial: {"id":"adaptive-homing-v1/42/50/5655/504e07e8","tick":5655,"x":-4.5,"y":-2.4,"vx":0,"vy":0,"ax":0,"ay":0,"targetX":-6,"targetY":0,"phase":"waiting"}. Original: NO_WITNESS_FOUND / structure-mixed-v2/42/44/right@192; fixed X±4.8/Y0 plus historical hint. New: current field/aperture first, then four coupled-state escape goals. Decision **accept**, independent replay **accept**, hash 465608c7, propagation/query 2015/594. Previous full-beam recovery=true. Exact generated controls and120Hz ship/mine traces: witnesses.json/gates.
