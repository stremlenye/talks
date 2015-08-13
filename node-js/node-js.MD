# Development for Node JS from statically typed languages developer perspective

## Intro

## Motivation
When I've started learning and developing for Node JS platform I dived deeply
into the significant world of fast prototyping, thin boilerplates and thousands
of libraries for every single demand I could imagine. At the same time I've met
a lot of implementations of the same things with different approaches and API's.
Some of them were really good, some was quite ok, and some left more questions
then answers.
During my investigation I've noticed and collected several most frequently
appeared frustrating "patterns" (from my perspective)

## Main part
### Dynamic type system abuse
The first thing I want to talk about is how people abusing the ability of JS
objects to be extended.
For example we have two simple functions:
```js
function baz (bar) {
  bar.name = bar.id % 2 ? getName(): getAnotherName()
}

function foo () {
  const bar = {
    id: 1
    description: 'xyz'
  }

  baz(bar)

  return bar
}
```

`foo` provides `bar` parameter to `baz` to let it assign some property and then
returns `bar` to the function caller. What's exactly wrong with this example?
Lets take a closer look.
Definition of `bar` includes two properties: `id` and `description`
```js
{
  id: 1
  description: 'xyz'
}
```
and the owner function doesn't know anything what could happen with `bar` during
`baz` execution. `baz` could be placed somewhere else even in third-party module
and modify structure of provided variable whatever the `bar` developer want to.
```js
function baz (bar) {
  bar.name = getName()
  if(mars_phase === getPhase(bar.id)) {
    bar.description = 'beware of troubles'
  }
}
```
Looks not so reliable as supposed to be, right? Thats a joke (which also
violates on single responsibility principle), but some `npm` packages used to do
such things. For example some of the `http` middlewares extend `request` object
with its own metadata or override `response` body in favor of its own
conventions.
So how I would prefer to see this API? Fist of all I don't want to pass my
own object somewhere else to be harmed and violated. So I define another `baz`
parameter:
```js
function baz (num) {
  const name = num % 2 ? getName() : getAnotherName()
  const description = mars_phase === getPhase(num) ? 'beware of troubles' : null
  return { name, description }
}
```
Now client function could decide to rely on `baz` return value as is or
cherrypick interested information:
```js
function foo () {
  const bar = {
    id: 1
    description: 'xyz'
  }

  const { name } = baz(bar.id)

  return {...bar, ...{ name }}
}
```
