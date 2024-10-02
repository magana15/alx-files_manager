import dbClient from './utils/db';

const waitConnection = () => new Promise((resolve, reject) => {
  let i = 0;
  const repeatFct = async () => {
    await setTimeout(() => {
      i += 1;
      if (i >= 10) {
        reject();
      } else if (!dbClient.isAlive()) {
        repeatFct();
      } else {
        resolve();
      }
    }, 1000);
  };
  repeatFct();
});

(async () => {
  console.log(dbClient.isAlive()); // Prints false initially because the connection is not ready yet
  await waitConnection(); // Wait until the connection is successful
  console.log(dbClient.isAlive()); // Prints true once the connection is ready
  console.log(await dbClient.nbUsers()); // Prints the number of users in the 'users' collection
  console.log(await dbClient.nbFiles()); // Prints the number of files in the 'files' collection
})();
