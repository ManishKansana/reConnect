// to run:
// make sure node.js is installed in your terminal
// then just run "node index.js"
// might need to install any non-native modules also?

const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const express = require('express');
const sio = require('socket.io');
const path = require('path');

// import classes
const User = require('./static/User');
const PostCard = require('./static/PostCard');

var app = express();
var server = http.Server(app);
var io = sio(server);

let htmlDirectory = path.resolve(__dirname+'/static');
app.use(express.static(htmlDirectory));
server.listen(4124);

// global for whether a user is logged in -- will need another to denote *which* user probably
var loggedIn = false;
var currentUser = -1;

app.get('/postCard', (req, res)=> {
    res.sendFile(path.join(__dirname, "./static/postCard.js"));
});

app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, './static/style.css')); // Serve your CSS file
});

// need to test the conditionals for these three gets
app.get('/', (req, res) => {
  if(loggedIn){
    let filePath = path.join(__dirname, "./static/index.html");
    res.sendFile(filePath);
  }
  else{
    let filePath = path.join(__dirname, "./static/Onboarding.html");
    res.sendFile(filePath);
  }
});

app.get('/login', (req, res) => {
  if(loggedIn){
    const filePath = path.join(__dirname, "./static/index.html");
    res.sendFile(filePath);
  }
  else{
    const filePath = path.join(__dirname, "./static/Onboarding.html");
    res.sendFile(filePath);
  }
});

app.get('/home', (req, res) => {
  if(loggedIn){
    const filePath = path.join(__dirname, "./static/index.html");
    res.sendFile(filePath);
  }
  else{
    const filePath = path.join(__dirname, "./static/Onboarding.html");
    res.sendFile(filePath);
  }
});

app.get('/profile', (req, res)=>{
    if(!loggedIn){
        const filePath = path.join(__dirname, "./static/Onboarding.html");
        res.sendFile(filePath);
    }
    else{
        const filePath = path.join(__dirname, "./static/profile.html");
        res.sendFile(filePath);
    }
});

app.get('/friends', (req, res)=>{
    if(!loggedIn){
        const filePath = path.join(__dirname, "./static/Onboarding.html");
        res.sendFile(filePath);
    }
    else{
        const filePath = path.join(__dirname, "./static/search.html");
        res.sendFile(filePath);
    }
});

/* functions/functionalities to write */
/* these could be functions or could just be implemented in the socket handlers! */

// search by username -- maybe start with exact matches? TRIP

// like a post

// comment on a post

// share a post

// create a post

// create a user TRIP

// check user credentials

/* LOADING FROM DATABASE */
let db = new sqlite3.Database('storage.db');

var Users = new Array();
// load users from database into array
let loadUsers = function() {
    db.each(`SELECT username username, password password, userID userID FROM users`, [], (err, row)=>{ //double check this SQL
        // these are arrays of user IDs
        let tmpFriends = new Array();
        let tmpRequests = new Array();

        db.each(`SELECT friendID friendID FROM friends WHERE userID = ?`, [row.userID], (err, row)=>{
            // add friend to vector
            tmpFriends.push(row.friendID);
        });
        // note to self: need to ensure that friend request backup is stored respective to who is sending/receiving the request
        db.each(`SELECT friendRequesting friendRequesting, userID userID FROM friendRequests WHERE userID = ?`, [row.userID], (err, row)=>{
            // add friend request (requesting person's user ID) to vector
            tmpRequests.push(row.friendRequesting);
        });

        let tmp = new User(row.userID, row.username, row.password, tmpFriends, tmpRequests);
        Users.push(tmp);
    });
};

var Posts = new Array();
// load posts from database into array
let loadPosts = function() {
    db.each(`SELECT userID userID, postID postID, postContent postContent, likeCount likeCount, shareCount shareCount FROM posts`, [], (err, row)=>{
        let tmpComments = new Array();
        db.each(`SELECT comment comment, commentID commentID FROM comments WHERE postID = ?`, [row.postID], (err, row)=>{
            // not doing anything with commentID yet?
            tmpComments.push(row.comment);
        });
        let tmp = new PostCard(row.postID, row.userID, "deprecated", row.postContent, row.likeCount, row.shareCount, tmpComments);
        Posts.push(tmp);
    });
};

// backup current program state (users and posts) to database -- called upon exit
let backupDB = function() {
    /* USER BACKUP */
    // let's see who all is here!
    let userIDs = new Array();
    for(let i = 0; i < Users.length; i++){
        userIDs.push(Users[i].getUserID());
    }

    // add completely new folks and update existing ones
    for(let i = 0; i < userIDs.length; i++){
        db.each(`SELECT username username FROM users WHERE userID = ?`, [userIDs[i]], (err, row)=>{
            if(row == undefined){
                // add user to the database
                db.run(`INSERT INTO users (userID, username, password) VALUES (?, ?, ?)`, [Users[i].getUserID(), Users[i].getUsername(), Users[i].getPassword()], (err, row)=>{});
                // add their friends
                for(let j = 0; j < Users[i].getFriends().length; j++){
                    db.run(`INSERT INTO friends (userID, friendID) VALUES (?, ?)`, [Users[i].getUserID(), Users[i].getFriends()[j]], (err, row)=>{});
                }
                // add their incoming friend requests
                for(let j = 0; j < Users[i].getIncomingFriendRequest().length; j++){
                    db.run(`INSERT INTO friendRequests (userID, friendRequesting) VALUES (?, ?)`, [Users[i].getUserID(), Users[i].getIncomingFriendRequest()[j]], (err, row)=>{});
                }
            }
            // if user is in the database already, update their stuff
            else{
                db.run(`UPDATE users SET username = ?, password = ? WHERE userID = ?`, [Users[i].getUsername(), Users[i].getPassword(), userIDs[i]], (err, row)=>{});
                // update their friends too
                for(let j = 0; j < Users[i].getFriends().length; j++){
                    db.each(`SELECT friendID friendID FROM friends WHERE userID = ?, friendID = ?`, [Users[i].getUserID(), Users[i].getFriends()[j]], (err, row)=>{
                        // console.log(row.userID);
                        // if not in database
                        if(row == undefined){
                            // add the friend
                            db.run(`INSERT INTO friends (userID, friendID) VALUES (?, ?)`, [Users[i].getUserID(), Users[i].getFriends()[j]], (err, row)=>{});
                        }
                    });
                }
                db.each(`SELECT friendID friendID FROM friends WHERE userID = ?`, [Users[i].getUserID()], (err, row)=>{
                    if(!Users[i].getFriends().includes(row.friendID)){
                        // delete friend from database
                        db.run(`DELETE FROM friends WHERE friendID = ?`, [row.friendID], (err, row)=>{});
                    }
                });
                // update their friend requests too
                for(let j = 0; j < Users[i].getIncomingFriendRequest().length; j++){
                    db.each(`SELECT friendRequesting friendRequesting FROM friendRequests WHERE userID = ?, friendRequesting = ?`, [Users[i].getUserID(), Users[i].getIncomingFriendRequest()[j]], (err, row)=>{
                        // if not in database
                        if(row == undefined){
                            // add the friend request
                            db.run(`INSERT INTO friendRequests (userID, friendRequesting) VALUES (?, ?)`, [Users[i].getUserID(), Users[i].getIncomingFriendRequest()[j]], (err, row)=>{});
                        }
                    });
                }
                db.each(`SELECT friendRequesting friendRequesting FROM friendRequests WHERE userID = ?`, [Users[i].getUserID()], (err, row)=>{
                    if(!Users[i].getIncomingFriendRequest().includes(row.friendRequesting)){
                        // delete friend request from database
                        db.run(`DELETE FROM friendRequests WHERE friendRequesting = ?`, [row.friendRequesting], (err, row)=>{});
                    }
                });
            }
        });
    }

    // delete the non-existent users from db
    db.each(`SELECT userID userID FROM users`, [], (err, row)=>{
        if(!userIDs.includes(row.userID)){
            // delete user from database
            db.run(`DELETE FROM users WHERE userID = ?`, [row.userID], (err, row)=>{

            });
            // delete their friends & requests too
            db.each(`SELECT friendID friendID FROM friends WHERE userID = ?`, [row.userID], (err, row)=>{
                db.run(`DELETE FROM friends WHERE friendID = ?`, [row.friendID], (err, row)=>{});
            });
            db.each(`SELECT friendRequesting friendRequesting FROM friendRequests WHERE userID = ?`, [row.userID], (err, row)=>{
                db.run(`DELETE FROM friendRequests WHERE friendRequesting = ?`, [row.friendRequesting], (err, row)=>{});
            });
        }
    });
    
    /* POST BACKUP */
    let postIDs = Array();
    for(let i = 0; i < Posts.length; i++){
        postIDs.push(Posts[i].ID);
    }
    for(let i = 0; i < postIDs.length; i++){
        db.each(`SELECT userID userID FROM posts WHERE postID = ?`, [postIDs[i]], (err, row)=>{
            if(row == undefined){
                // add post to the database
                db.run(`INSERT INTO posts (userID, postID, postContent, likeCount, shareCount) VALUES (?, ?, ?, ?, ?)`, 
                [Posts[i].PosterID, Posts[i].ID, Posts[i].content, Posts[i].likes, Posts[i].shares], (err, row)=>{});
                // add comments as well
                for(let j = 0; j < Posts[i].comments.length; j++){
                    db.run(`INSERT INTO comments (postID, comment) VALUES (?, ?)`, [Posts[i].ID, Posts[i].comments[j]], (err, row)=>{});
                }
            }
            // if post is in the database already, update the stats jic
            else{
                db.run(`UPDATE posts SET postContent = ?, likeCount = ?, shareCount = ? WHERE postID = ?`, 
                [Posts[i].content, Posts[i].likes, Posts[i].shares], (err, row)=>{});
                // update comments too
                for(let j = 0; j < Posts[i].comments.length; j++){
                    // trying db.get here uhh
                    db.get(`SELECT comment comment FROM comments WHERE postID = ?, comment = ?`, 
                    [Posts[i].ID, Posts[i].comments[j]], (err, row)=>{
                        // if not in database
                        if(row == undefined){
                            // add the comment to the database
                            db.run(`INSERT INTO comments (postID, comment) VALUES (?, ?)`, [Posts[i].ID, Posts[i].comments[j]], (err, row)=>{});
                        }
                    });
                }
                db.each(`SELECT comment comment FROM comments WHERE postID = ?`, [Posts[i].ID], (err, row)=>{
                    if(!Posts[i].comments.includes(row.comment)){
                        // delete comment from database
                        db.run(`DELETE FROM comments WHERE comment = ?`, [row.comment], (err, row)=>{
                            // deleted!
                        });
                    }
                });
            }
        });
    }

    // delete the non-existent posts from db
    db.each(`SELECT postID postID FROM posts`, [], (err, row)=>{
        if(!postIDs.includes(row.postID)){
            // delete post from database
            db.run(`DELETE FROM posts WHERE postID = ?`, [row.postID], (err, row)=>{});
            // delete their comments
            db.run(`DELETE FROM comments WHERE postID = ?`, [row.postID], (err, row)=>{});
        }
    });
};


// note: to access the interface (once we have one), use this URL in your browser after running index.js:
// localhost:412401

/* FRONTEND HANDLERS */
io.on('connection', (socket)=>{
    socket.on('test', (data)=>{
        console.log("test signal received");
    });

    socket.on('search', (data)=>{
        console.log("searching...");
        // search function call?
        // socket.emit all the results somehow?
        // --> maybe something like `socket.emit("results", [user1, user2, user3]);`
    });

    socket.on('login attempt', (data)=>{
        // for now...
        loggedIn = true;
        socket.emit('loginAttemptResults', 'true');
        console.log("set loggedIn to true");
        // TODO: set currentUser
    });

    socket.on('registration attempt', (data)=>{
        // for now...
        socket.emit('registerAttemptResults', 'true');
        console.log("new user registered");
    });

    socket.on("empty values", (data)=>{
        console.log("empty values");
    });

    // this might be funky for now?
    socket.on("need posts", (data)=>{
        // use current user value to determine what posts to show
        return;
        let index = -1;
        for(let i = 0; i < Users.length; i++){
            if(currentUser == Users[i].getUserID()){
                index = i;
                break;
            }
            if(i == Users.length-1){
                console.log("couldn't find current user");
                return;
            }
        }

        let friendIDs = new Array();
        // get the user IDs of every friend
        for(let i = 0; i < Users[index].getFriends().length; i++){
            friendIDs.push(Users[index].getFriends()[i]);
        }

        // TODO test this
        // now cycle through our mega array of all posts, grab ones that belong to a friend (go backwards to get newest) (up to 15 for now)
        let postsToSend = new Array();
        let posterID = -1;
        let cnt = 0;
        for(let i = Posts.length-1; i >= 0; i--){
            posterID = Posts[i].PosterID;
            if(friendIDs.includes(posterID)){
                let postInfo = new Array();
                postInfo.push(Posts[i].ID);
                postInfo.push(Posts[i].username);
                postInfo.push(Posts[i].content);
                postInfo.push(Posts[i].likes);
                postInfo.push(Posts[i].shares);
                // comments too
                postsToSend.push(postInfo);
                postsToSend.push(Posts[i].comments);
                // empty array
                postInfo.length = 0;
                cnt++;
            }
            if(cnt == 15){
                break;
            }
        }
        socket.emit("herePosts", {posts: postsToSend})
    });

    socket.on('exit', (data)=>{
        console.log("Exiting...");
        exitProgram();
    });
});

/* MISC FUNCTIONS? */
let exitProgram = function() {
    backupDB();
    db.close();
}

/* INIT FUNCTION CALLS */
loadUsers();
loadPosts();
