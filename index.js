// to run:
// make sure node.js is installed in your terminal
// then just run "node index.js"
// might need to install any non-native modules also?

const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const express = require('express');
const sio = require('socket.io');
const path = require('path');

// will need to import classes here once made (User.js and Post.js files)

var app = express();
var server = http.Server(app);
var io = sio(server);

let htmlDirectory = path.resolve(__dirname);
app.use(express.static(htmlDirectory));
server.listen(412401);

/* LOADING FROM DATABASE */
let db = new sqlite3.Database('storage.db');

var Users = new Array();
// load users from database into array
let loadUsers = function() {
    db.each(`SELECT username username, password password, userID userID FROM users`, [], (err, row)=>{ //double check this SQL
        let tmp = new User(row.username, row.password);
        // these are arrays of user IDs
        let tmpFriends = Array();
        let tmpRequests = Array();

        tmp.setUserID(row.userID);

        // may not need friend ID? not sure where it would go
        db.each(`SELECT friend friend, friendID friendID FROM friends WHERE userID = ?`, [row.userID], (err, row)=>{
            // add friend to vector
        });
        // note to self: need to ensure that friend request backup is stored respective to who is sending/receiving the request
        db.each(`SELECT friendRequesting friendRequesting, friendID friendID FROM friendRequests WHERE userID = ?`, [row.userID], (err, row)=>{
            // add friend request to vector
        });

        tmp.setFriends(tmpFriends);
        tmp.setIncomingFriendRequests(tmpRequests);
        Users.push(tmp);
    });
};

var Posts = new Array();
// load posts from database into array
let loadPosts = function() {
    db.each(`SELECT userID userID, postID postID, postContent postContent, likeCount likeCount, shareCount shareCount, 
    postVisibility postVisibility FROM posts`, [], (err, row)=>{
        let tmp = new Post();
        let tmpComments = new Array();

        tmp.setPosterID(row.userID);
        tmp.setPostID(row.postID);
        tmp.setPostContent(row.postContent);
        tmp.setlikeCount(row.likeCount);
        tmp.setShares(row.shareCount);
        tmp.setPostVisibility(row.postVisibility);

        db.each(`SELECT comment comment, commentID commentID FROM comments WHERE postID = ?`, [row.postID], (err, row)=>{
            // may not need comment ID? not sure where it would go
            tmpComments.push(row.comment);
        });

        tmp.setComments(tmpComments);
        Posts.push(tmp);
    });
};

// backup current program state (users and posts) to database -- called upon exit
let backupDB = function() {
    /* USER BACKUP */
    // let's see who all is here!
    let userIDs = Array();
    for(let i = 0; i < Users.length; i++){
        userIDs.push(Users[i].getUserID());
    }

    // add completely new folks and update existing ones
    for(let i = 0; i < userIDs.length; i++){
        db.each(`SELECT username username FROM users WHERE userID = ?`, [userIDs[i]], (err, row)=>{
            // this might need to be the string "null" -- TODO: test it!
            if(row.username == null){
                // add user to the database ###
                // add their friends ###
            }
            // if user is in the database already, update their stuff
            else{
                db.run(`UPDATE users SET username = ?, password = ? WHERE userID = ?`, [Users[i].getUsername(), Users[i].getPassword(), userIDs[i]], (err, row)=>{
                    // good job!
                });
                // update their friends too
                for(let i = 0; i < Users[i].getFriends().length; i++){
                    db.run(`SELECT friendID friendID FROM friends WHERE userID = ?, friendID = ?`, [Users[i].getUserID(), Users[i].getFriends()[i]], (err, row)=>{
                        // if not in database
                        if(row.friendID == null){
                            // add the friend ###
                        }
                    });
                }
                db.each(`SELECT friendID friendID FROM friends WHERE userID = ?`, [Users[i].getUserID()], (err, row)=>{
                    if(!Users[i].getFriends().includes(row.friendID)){
                        // delete friend from database
                        db.run(`DELETE FROM friends WHERE friendID = ?`, [row.friendID], (err, row)=>{
                            // deleted!
                        });
                    }
                });
                // update their friend requests too
                for(let i = 0; i < Users[i].getIncomingFriendRequests().length; i++){
                    db.run(`SELECT friendRequesting friendRequesting FROM friendRequests WHERE userID = ?, friendRequesting = ?`, [Users[i].getUserID(), Users[i].getIncomingFriendRequests()[i]], (err, row)=>{
                        // if not in database
                        if(row.friendRequesting == null){
                            // add the friend request ###
                        }
                    });
                }
                db.each(`SELECT friendRequesting friendRequesting FROM friendRequests WHERE userID = ?`, [Users[i].getUserID()], (err, row)=>{
                    if(!Users[i].getIncomingFriendRequests().includes(row.friendRequesting)){
                        // delete friend request from database
                        db.run(`DELETE FROM friendRequests WHERE friendRequesting = ?`, [row.friendRequesting], (err, row)=>{
                            // deleted!
                        });
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
                db.run(`DELETE FROM friends WHERE friendID = ?`, [row.friendID], (err, row)=>{

                });
            });
            db.each(`SELECT friendRequesting friendRequesting FROM friendRequests WHERE userID = ?`, [row.userID], (err, row)=>{
                db.run(`DELETE FROM friendRequests WHERE friendRequesting = ?`, [row.friendRequesting], (err, row)=>{

                });
            });
        }
    });
    
    /* POST BACKUP */
    let postIDs = Array();
    for(let i = 0; i < Posts.length; i++){
        postIDs.push(Posts[i].getPostID());
    }
    for(let i = 0; i < postIDs.length; i++){
        db.each(`SELECT userID userID FROM posts WHERE postID = ?`, [postIDs[i]], (err, row)=>{
            // this might need to be the string "null" -- TODO: test it!
            if(row.userID == null){
                // add post to the database ###
            }
            // if post is in the database already, update the stats jic
            else{
                db.run(`UPDATE posts SET postContent = ?, likeCount = ?, shareCount = ?, postVisibility = ? WHERE postID = ?`, 
                [Posts[i].getPostContent(), Posts[i].getLikeCount(), Posts[i].getShareCount(), Posts[i].getPostVisibility()], (err, row)=>{
                    // good job!
                });
                // update comments too
                for(let i = 0; i < Posts[i].getComments().length; i++){
                    // this should maybe be db.get?
                    db.run(`SELECT comment comment FROM comments WHERE postID = ?, comment = ?`, 
                    [Posts[i].getPostID(), Posts[i].getComments()[i]], (err, row)=>{
                        // if not in database
                        if(row.comment == null){
                            // add the comment to the database ###
                        }
                    });
                }
                db.each(`SELECT comment comment FROM comments WHERE postID = ?`, [Posts[i].getPostID()], (err, row)=>{
                    if(!Posts[i].getComments().includes(row.comment)){
                        // delete comment from database
                        db.run(`DELETE FROM comments WHERE comment = ?`, [row.comment], (err, row)=>{
                            // deleted!
                        });
                    }
                });
            }
        });
    }
};

// note: to access the interface (once we have one), use this URL in your browser after running index.js:
// localhost:412401

/* FRONTEND HANDLERS */
// i added some more for funsies
io.on('connection', (socket)=>{
    // handlers for messages from the front end go inside here

    // for example:
    socket.on('test', (data)=>{ // 'test' is the message from the front end, data is also from frontend
        // do something with data here, etc etc
        console.log("test signal received\n");
    });

    socket.on('search', (data)=>{
        console.log("searching...");
        // search function call?
        // socket.emit all the results somehow?
        // --> maybe something like `socket.emit("results", [user1, user2, user3]);`
    });

    socket.on('', (data)=>{

    });

    socket.on('exit', (data)=>{
        console.log("Exiting...");
        exitProgram();
    });
});

/* MISC FUNCTIONS? */
let exitProgram = function() {
    backupDB();
}

/* INIT FUNCTION CALLS */
loadUsers();
loadPosts();
