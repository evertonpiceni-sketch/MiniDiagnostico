try {
  new URL('/rest/v1/foo');
} catch(e) {
  console.log(e.message);
}
