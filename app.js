const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const jwt = require("jsonwebtoken");

const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "twitterClone.db");
console.log(dbPath);

const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// ....Register API....

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  console.log(password.length);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO user (username,name, password, gender) VALUES ('${username}', '${name}','${hashedPassword}', '${gender}')`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send("User created successfully");
  } else if (password.length > 6) {
    response.status = 400;
    response.send("User already exists");
  } else {
    response.status = 400;
    response.send("Password is too short");
  }
});

// .....Access JWT Token....

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//....login API....

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      response.send("Login Success!");
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// .....API 3....

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  try {
    const selectUserQuery = `
    SELECT username,tweet, date_time AS dateTime  FROM user INNER JOIN tweet INNER JOIN follower ON user.user_id = tweet.user_id = follower.follower_user_id  ORDER BY follower.follower_user_id ASC LIMIT 0, 4 ;
    `;
    const followersArray = await db.all(selectUserQuery);
    console.log(followersArray);
    response.send(followersArray);
  } catch (e) {
    console.log(e);
    response.status = 401;
    response.send("Invalid request");
  }
});

// .... API 4......

app.get("/user/following/", authenticateToken, async (request, response) => {
  try {
    const { user_id } = request.params;
    const selectUserFollowingPeople = `
    SELECT name FROM user INNER JOIN follower ON user.user_id = follower.following_user_id Group by name;`;
    const followerUser = await db.all(selectUserFollowingPeople);
    response.send(followerUser);
  } catch (e) {
    response.status = 401;
    response.send("Invalid Request");
  }
});

// ..... API 5 .....

app.get("/user/followers/", authenticateToken, async (request, response) => {
  try {
    const { user_id } = request.params;
    const selectUserFollowingPeople = `
    SELECT name FROM user INNER JOIN follower ON user.user_id = follower.follower_user_id Group by name;`;
    const followerUser = await db.all(selectUserFollowingPeople);
    response.send(followerUser);
  } catch (e) {
    response.status = 401;
    response.send("Invalid Request");
  }
});

// ....API6......

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  try {
    const { tweetId } = request.params;
    const getTweetQuery = `SELECT tweet, count(like.like_id) AS likes, count(reply.reply_id) AS replies, date_time AS dateTime from tweet INNER JOIN like INNER JOIN reply ON tweet.tweet_id = like.tweet_id = reply.tweet_id WHERE tweet.tweet_id = ${tweetId};`;

    const responseResult = await db.get(getTweetQuery);
    response.send(responseResult);
  } catch (e) {
    response.status = 401;
    response.send("Invalid Request");
  }
});

//....API9....

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  try {
    const userQuery = `SELECT tweet, COUNT(like_id) AS likes, COUNT(reply_id) AS replies, date_time AS dateTime FROM tweet INNER JOIN reply INNER JOIN like ON tweet.tweet_id = reply.tweet_id = like.tweet_id  GROUP BY tweet.user_id; `;

    const tweets = await db.all(userQuery);
    response.send(tweets);
  } catch (e) {
    response.send("Invalid Request");
  }
});

//....API10....

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  try {
    const { tweet, userId, dateTime } = request.body;

    const UserTweetsQuery = `INSERT INTO tweet(tweet, user_id, date_time) VALUES('${tweet}', ${userId}, '${dateTime}');`;
    console.log(UserTweetsQuery);
    const newTweet = await db.run(UserTweetsQuery);
    const tweetId = newTweet.lastID;
    console.log(newTweet);
    response.send("Tweet created");
  } catch (e) {
    console.log(e);
    response.send("Invalid Request");
  }
});

// .... API 11....

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    try {
      const { tweetId } = request.params;
      const deleteQuery = `DELETE FROM tweet WHERE tweet_id= ${tweetId};`;
      const deletedUser = await db.run(deleteQuery);
      response.send("Tweet Removed");
    } catch (e) {
      response.status = 401;
      response.send("Invalid Request");
      console.log(e);
    }
  }
);

// .....API7......

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    try {
      const { tweetId } = request.params;
      let userNameList = [];
      const selectUserQuery = `SELECT username FROM user INNER JOIN like ON user.user_id = like.user_id WHERE like.tweet_id = ${tweetId};
    `;
      const likesArray = await db.all(selectUserQuery);
      for (let user in likesArray) {
        userNameList.push(likesArray[user].username);
      }
      if (userNameList.length !== 0) {
        response.send({ likes: userNameList });
      } else {
        response.send("Invalid Request");
      }
    } catch (e) {
      response.send("Invalid Request");
    }
  }
);

// .....API8.....

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    try {
      const { tweetId } = request.params;
      let nameList = [];
      const selectUserQuery = `SELECT name, reply FROM user INNER JOIN reply ON user.user_id = reply.user_id WHERE reply.tweet_id = ${tweetId};
    `;
      const repliesArray = await db.all(selectUserQuery);
      for (let user in repliesArray) {
        nameList.push(repliesArray[user]);
      }
      if (nameList.length !== 0) {
        response.send({ replies: nameList });
      } else {
        response.send("Invalid Request");
      }
    } catch (e) {
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
