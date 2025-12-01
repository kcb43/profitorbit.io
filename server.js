// server.js

import express from "express";

import cors from "cors";

import fs from "fs";

import https from "https";



const app = express();

app.use(cors());

app.use(express.json());



// SSL Certificate options

const options = {

  key: fs.readFileSync("./key.pem"),  // relative to current working dir

  cert: fs.readFileSync("./cert.pem")

};



// Temporary in-memory database for testing

const listings = {

  "1": {

    id: "1",

    title: "Nike Air Max",

    price: "80",

    description: "Brand new shoes",

    category: "Shoes",

    condition: "New",

    images: [

      "https://yourwebsite.com/img1.jpg",

      "https://yourwebsite.com/img2.jpg"

    ]

  }

};



// GET a listing

app.get("/api/crosslistings/:id", (req, res) => {

  const id = req.params.id;

  const listing = listings[id];



  if (!listing) {

    return res.status(404).json({ error: "Listing not found" });

  }



  res.json(listing);

});



// POST a new listing

app.post("/api/crosslistings", (req, res) => {

  const id = Date.now().toString();

  const newListing = { id, ...req.body };

  listings[id] = newListing;

  res.json(newListing);

});



// DELETE a listing

app.delete("/api/crosslistings/:id", (req, res) => {

  const id = req.params.id;

  delete listings[id];

  res.json({ success: true });

});



// Start HTTPS server

https.createServer(options, app).listen(3000, () => {
  console.log("API running on https://localhost:3000");
});
