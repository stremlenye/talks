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

  return { ...bar, ...{ name } }
}
```

### Pure functions
A quite popular package (more than two million downloads last month) has quite
similar API: the function accepts string and array as a params and returns
another string as a result.
```js
const arr = []
const result = foo('input string', arr)
```
Seems pretty simple signature, but the story has not finished yet. If you will
read the documentation for this function the array parameter is not actually
input parameter – that's optional OUTPUT parameter which contains some metadata
annotating the return value.
So whats wrong with this function? Actually it has a bunch of design problems.

The first is - confusing API. If we'll cover this function we'll notice that
`arr` parameter doesn't influence on the result value. So looks like its up to
client code provide array to the function or not. But if we don't provide it
we don't receive part of its output.

That reminded me the WinAPI, this old fashioned API for MS Windows designed
ecosystem to let perform system calls and widely used for desktop application
development more then ten years ago.
```cpp
PAINTSTRUCT ps;
HDC hdc;
TCHAR greeting[] = _T("Hello, World!");

switch (message)
{
  case WM_PAINT:
    hdc = BeginPaint(hWnd, &ps);

    TextOut(hdc, 5, 5, greeting, _tcslen(greeting));

    EndPaint(hWnd, &ps);
    break;
}
```
It included mostly procedural calls which operated few simple data structures
and used to return special structure to determine was call successful or not.
This API used a lot of passed `by reference` params to return multiple values
in environment of strictly predefined data types. This API had a reason to go
this way, but in modern JS infrastructure you really doesn't have to commit
such tradeoffs.
It seems developer decided that the real return data is not relevant with
optional one and shouldn't be placed inside one object structure, but should be
calculated simultaneously. Lest change a bit this function signature:
```js
const [result, arr] = foo('input string')
```
Here we return an array of result and array output value and
destructuring it to obtain named variables. Performed this refactoring we
satisfied both sides: those clients who interested in full information and those
who need any particular part.
```js
const [result, arr] = foo('input string')
const [result] = foo('input string')
const [, arr] = foo('input string')
```
If this syntax looks slightly unfamiliar to you, take a look at common builtin
type of number of not only functional programming oriented languages called
`Tuple`
```scala
def foo = (1, "hello", Console) // define function which returns Tuple of three elements
val (num, str, type) = foo() // destructuring Tuple into multiple varibles
println(num) // 1
println(str) // hello
println(type) // scala.Console$@424c0bc4
```
This data structure helps to keep functions pure like was presented in current
example. How it helps on a daily basis?
For example you need to sequentially perform several `HTTP` requests and combine
their results into one. The most common way how folks implement it looks like
this:
```js
function login (login, password) {
  let user = {}, token

  return http('/tokens', {
    method: 'post',
    body: JSON.stringify({ email, password })
  }).then(response => {
    token = response.body.token
    user.id = response.body.userId
    return http(`/user/${user.id}`, {}, token)
  }).then(response => {
    user = response.body
    return http(`/project/${user.id}`, {}, token)
  }).then(response => {
    const projects = response.body
    return {
      token,
      user,
      projects
    }
  })
}
```
Looks quite ok for the first draft, but when we decide to revisit this function
in future and refactor a bit, for example extract `user` and `project` fetching
into separate functions, we will find our selfs in trouble.
The reason is coupling: each fetching step depends on previously fetched data,
which also obtained through shared closures. Lets get rid of them.

```js
function login (login, password) {
  return http('/tokens', {
    method: 'post',
    body: JSON.stringify({ email, password })
  })
  .then(({ { user: { id }, token } }) => ([id, token]))
  .then(([userId, token]) => Promise.all([
    http(`/user/${userId}`, {}, token),
    http(`/project/${userId}`, {}, token)
  ]).then([{ body: user }, { body: projects }] => {
    return {
      token,
      user,
      projects
    }
  }))
}
```
Here we are: each step is independent of surroundings, takes its parameters and
return value, could be extracted as pure function (if we could pretend that
`http` is also pure)
