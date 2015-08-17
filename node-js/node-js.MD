# Development for Node JS from statically typed languages developer perspective

## Intro
Hi,
my name is Yuriy Ankudinov and am a software developer at commercetools.
My team is developing merchants administration console as part of the platform
using NodeJs for backend so the most things I'll talk about I'am dealing with on
the daily basis.

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
Type system of the Javascript differs a lot from common one of most popular
enterprise programming languages like Java, Scala, C# and so on. Custom types
are functions and objects all have one type and acts more like hash maps then
objects: we could define new properties on every object and remove ones when
we desire.
The first thing I want to talk about is how objects ability to be extended
could be abused in average situation.
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
Function provides parameter to another one and returns it to the enclosing
scope. What's exactly wrong with this example? Lets take a closer look.
Definition of `bar` includes two properties: `id` and `description`
```js
{
  id: 1
  description: 'xyz'
}
```
and the owner function doesn't know anything what could happen with its own
object during execution. This function could be obtained from other module,
even third-party one, could be supposed to be extracted out current module or
whatever and eventually refactored to follow different logic:
```js
function baz (bar) {
  bar.name = getName()
  if(mars_phase === getPhase(bar.id)) {
    bar.description = 'beware of troubles'
  }
}
```
Looks not so reliable as supposed to be, right? But some `npm` packages used to
do such things. For example some of the `http` middlewares extend `request`
object with its own metadata or override `response` body in favor of its own
conventions.

How could we improve this function API? First of all `baz` function doesn't
even need the entire object – just one number it relies on.
Also I don't want to pass my own object somewhere else to be harmed and violated.
So I define another `baz` parameter make it to return the result of the
computation:
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
We shared only necessary data and decided what to do with result without any
care how it was calculate. No data was harmed or uncovered. Pretty simple idea
which saves a lot of debugging time as far as you exactly know the place where
you data could be modified.

And few words about `delete` clause. A lot of simple `CRUD` http services, which
are most common applications implemented nowadays, in attempt to prevent
uncover of some sensible data implement functions which delete particular fields
of object:
```js
function formatResult (res) {
  delete res.password
}
```
First of all: stop it - this is not yours, somebody may need it, Ok?

Second idea
is: are you hundred percent sure that this particular field will be one and only
thing you don't want to expose? Another developer one day may define an
`accountInfo` field on the entity and this function wouldn't save you if
somebody forget to modify it. So format your result carefully:
```js
function formatResult (res) {
  return {
    id: res.id,
    name: res.name,
    description: res.description,
  }
}
```

### Pure functions
A quite popular package (more than two million downloads last month) has quite
similar API as our first example: the function accepts string and array as a
params and returns another string as a result.
```js
const arr = []
const result = foo('input string', arr)
```
Signature seems pretty simple, but the story has not finished yet. If you will
read the documentation for this function you will find that array parameter is not actually
input parameter, but optional OUTPUT parameter which contains some metadata
annotating the return value.
So whats wrong with this function? Actually it has a bunch of design problems.

The first is - confusing API. If we'll cover this function with tests we'll
notice that `arr` parameter doesn't influence on the result value. So looks like
its up to client code provide array to the function or not. But if we don't
provide it we cant receive part of internally calculated output.

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
This data structure helps to avoid defining single purpose data structures and
return simultaneously calculated but not tightly connected data. How it helps on a daily basis?
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
Looks quite ok for the first draft, but lets improve it a bit. First of all we
could perform second and third requests at one time as far as they relies on
same data. In fact we also notice that the closure clause is not necessary for
new implementation. Lets get rid of it:

```js
function login (login, password) {
  return http('/tokens', { // createToken(login, password)
    method: 'post',
    body: JSON.stringify({ email, password })
  })
  .then(({ { user: { id }, token } }) => ([id, token]))
  .then(([userId, token]) => Promise.all([
    http(`/user/${userId}`, {}, token), // fetchUser(userId, token)
    http(`/project/${userId}`, {}, token) // fetchProjects(userId, token)
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
return value, could be extracted as pure function (if we could assume that
`http` is also pure) and reused wherever you want.

#### Dependency injection
Another one Nodejs concept which I want o discuss is environment variables.
I've saw a lot of different ways how developers use this feature widely spread
around the ecosystem and most frequently met left more questions then answers.
When I first learned about environment variables, I've thought
"What a lovely way to switch configurations" but the devil was in the detail.
```js
export function foo() {
  if(process.env.NODE_ENV === 'test') {
    // do something
  }
  if(process.env.OTHER_VAR === 'SOME_FLAG') {
    // do another thing
  }
  // perform some common operations
}
```
And this detail was simple: thats to easy for developer to access this variables
so they started abusing them. So what problem could we see here? If we will look
at this function from slightly different angle, we could notice that this
function changes its own flow depending not on its own params, but eventually on
environment variable which is set somewhere else by nobody knows who.

Another problem here is two `if` clauses, which are actually increases
[Cyclomatic complexity](https://en.wikipedia.org/wiki/Cyclomatic_complexity) for
additional two points. If you are not common with this measurement, you could
think about it like a quantity of test should be written to cover this function
for hundred percent.

In our case that means that we should write couple additional tests, setting
proper environment variables sequentially. And that would be the only way to
describe how does this function works, because no one of the language features
was not used: there is no signature which could describe the dependency,
no input params validation.

If we take a closer look at environment variables you could notice that there
is no difference between them and classical global variables which are avoided
to be used in most programming languages.

There is a huge list of reasons why global variables are so complained starting
from hidden dependencies and hard testing to concurrent assignment issues. And
things getting worth as far as your project grows.

To take things under control and deal with growing complexity years ago people
invented such thing as [Dependency injection](http://www.martinfowler.com/articles/injection.html).
In fact this idea basics are laying on simple fundamental rule that function
becomes self-descriptive and predictable if it's relies only on its own params.

As first step to apply DI for our function will be to define the two params:
```js
export function foo(env, flag) {
  if(env === 'test') {
    // do something
  }
  if(flag === 'SOME_FLAG') {
    // do another thing
  }
  // perform some common operations
}
```
So now our function explicitly defines two dependencies it's waiting for to be
supplied with. So we make the external code to care about which function flow to
choose also giving it an opportunity to change this flow independent of actual
environment. Much more flexible, isn't it?

But such flags as `env` and `flag` is not very descriptive it self and could
mean a lot of things under the hood.

Most of the time we use environment variables to make our code not to perform
http requests during test run, or to use test endpoint to run integration tests
and so on. Also our `flag` could switch the `Accept` header value.

That the way how we could uncover real dependency which this function desired:
```js
export function foo(endpoint, responseType) {
  http(endpoint, {
    headers: {
      'Accept': responseType
    }
  })
  // perform some common operations
}
```
That still doesn't allow us to switch of http request during unit tests run.

Lets apply dependency injection ones more. Here we have strong dependency on
`http` function. Lets assume that the signature of this function is:
```scala
http(url, options): Promise[ response, error ]
```
and rewrite the our function with this assumption:
```js
export function foo(http, endpoint, responseType) {
  http(endpoint, {
    headers: {
      'Accept': responseType
    }
  })
  // perform some common operations
}
```
So our production code could provide an external `http` function as a param and
for test we could use simple spies:
```js
const httpMock = createSpy().toReturn(new Promise((res, rej) => {
  res({/* response */})
})))
foo(httpMock, 'endpoint', 'application/json')
```
As an extra step we could get rid of `http` reference in external code and
incapsulate it inside one module. That is quite useful especially for large
applications where depending on the API much more safer and flexible solution,
then depending on particular implementation.

Lets decouple deps a little bit:
```js
export function foo(http) {
  return (endpoint, responseType) => {
    http(endpoint, {
      headers: {
        'Accept': responseType
      }
    })
    // perform some common operations
  }
}

//bind-http.js
import http from 'http'

export default bindHttp(func) {
  return func(http)
}
```
Now external code doesn't need to know anything about http module
implementation and care about setting proper deps for our function or importing
them to its own scope. And we still have an option of direct injection of http
dependency for test or customization purpose.

### Conclusion
That was the last thing I want to discuss today.
At the end I want to say, all the technics I've was speaking about are supposed
to help sort out the main deal of the software development: taking complexity
under control. As it was said, that not so hard to implement complex things –
its hard to implement them in easy way.
Thank you!
