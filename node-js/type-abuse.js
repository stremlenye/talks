function foo () {
  const bar = {
    id: 1
    description: 'xyz'
  }

  baz(bar)

  return bar
}

function baz (bar) {
  bar.name = 42
}
