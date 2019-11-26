import produce from 'immer';
import { Observable, fromEvent } from 'rxjs';
import { tap, throttleTime, debounceTime, share, map, mapTo, startWith } from 'rxjs/operators';

const cherow = require('cherow');

console.log("Hello world!");

const setupCommands = [];
const drawCommands = [];

const getContextAccess = function(parsed) {
  const helper = () => {
  }
  console.log(parsed);
};

const getCommand = function(description, command) {
  const fakeContext = {};
  const modifiedContext = produce(fakeContext, command);

  const inputs = [];
  const outputs = [];

  for (const name in modifiedContext) {
    console.log("Name", name);
    outputs.push(name);
    //const fun = '' + modifiedContext[name];
    //console.log(fun);
    /*
    const parsed = cherow.parse(fun);
    console.log(parsed);
    for (let i = 0; i < parsed.body.length; i++) {
      const params = parsed.body[i].expression.params);
      console.log(params);
    }
    */
  }

  const cmd = {
    description: description,
    command: command,
    inputs: inputs,
    outputs: outputs
  };
  return cmd;
};

const sc = function() {
  return setupCommands.push(getCommand(...arguments));
};

const dc = function() {
  return drawCommands.push(getCommand(...arguments));
};

const lazy = function (creator) {
  let res;
  let processed = false;
  return function () {
    if (processed) return res;
    res = creator.apply(this, arguments);
    processed = true;
    return res;
  };
};

const lazyPromisify = (value) => {
  return lazy(() => new Promise(resolve => resolve(value)));
};

const lazyPromise = (f) => {
  return lazy(() => new Promise(f));
};

sc('Setup context',
  ctx => {
    //ctx.width = lazyPromisify(640);
    //ctx.height = lazyPromisify(480);
    ctx.resize$ =
      lazyPromise(async (resolve) =>
        resolve(
          fromEvent(window, 'resize')
          .pipe(
            debounceTime(250),
            throttleTime(250),
            tap(evt => console.log("resize")),
            share(),
            startWith(null)
            )));
    ctx.width$ = lazyPromise(async (resolve) => resolve((await ctx.resize$()).pipe(mapTo(window.innerWidth))));
    ctx.height$ = lazyPromise(async (resolve) => resolve((await ctx.resize$()).pipe(mapTo(window.innerHeight))));
  });

sc('Create and append canvas',
   ctx => {
     ctx.canvas = lazyPromise(async (resolve) => {
       const canvas = document.createElement('canvas');
       document.body.style = 'overflow: hidden; margin: 0px;';
       document.body.appendChild(canvas);
       (await ctx.width$()).subscribe(width => canvas.width = width);
       (await ctx.height$()).subscribe(height => canvas.height = height);
       resolve(canvas);
     });
   });

sc('Get GL context',
  ctx => {
    ctx.gl = lazyPromise(async (resolve, reject) => {
      const gl = (await ctx.canvas()).getContext('webgl');

      // Only continue if WebGL is available and working
      if (gl === null) {
        reject("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
      }

      // Set clear color to black, fully opaque
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      // Clear the color buffer with specified clear color
      gl.clear(gl.COLOR_BUFFER_BIT);

      resolve(gl);
    });
  });

sc('Start command chain',
  ctx => {
    ctx.start = lazyPromise(async (resolve) => {
      resolve(await ctx.gl());
    });
  });

let context = {};
for (let i = 0; i < setupCommands.length; i++) {
  //context = produce(context, setupCommands[i].command);
  setupCommands[i].command(context);
}
context.start();

const rf = function() {
  for (let i = 0; i < drawCommands.length; i++) {
    drawCommands[i](context);
  }
  requestAnimationFrame(rf);
};

requestAnimationFrame(rf);
