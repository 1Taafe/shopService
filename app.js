const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const cors=require('cors')
const app = express();
const port = 7700;

const pool = new Pool({
  user: 'shopuser',
  host: 'localhost',
  database: 'shop',
  password: 'password',
  port: 5432, // or the port of your database server
});

app.use(express.json());
app.use(cors({
  origin: '*'
}));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  console.log(login,password);
 const query="select * from login($1,$2)"
 const values=[login,password];

  try {
    console.log("try");
    const client=await pool.connect();
    const result = await client.query(query,values);
    console.log("result");
    const user = result.rows[0];
    console.log(user);
    return res.status(200).json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

//get-запрос на получение пунктов выдачи
app.get('/points', (req, res) => {
  pool.query('SELECT * FROM get_all_point_of_issue()', (err, dbRes) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
      console.log(dbRes.rows);
    res.json(dbRes.rows);
  });
});


//гет-запрос на получение заказов
app.get('/showorders', async (req, res) => {
  const userId = req.params.userId;

  try {
    const query = `SELECT * FROM get_order_by_user_id($1)`;
    const values = [userId];
    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//создание пользователя (регистрация)
app.post('/users/create', async (req, res) => {
  const { name, password, phonenumber,login,role="customer" } = req.body;

  try {
    const client = await pool.connect();
    const exists = await client.query(
      'SELECT 1 FROM users WHERE login = $1 OR phonenumber = $2',
      [login, phonenumber]
    );
    if (exists.rows.length > 0) {
      res.status(400).send('User with the same login or phone number already exists');
      return;
    }
    const result = await client.query(
      'INSERT INTO users (name, password, phonenumber,login,role) VALUES ($1, $2, $3, $4,$5) RETURNING *',
      [name, password, phonenumber,login,role]
    );
    client.release();
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

//добавление нового товара
app.post('/newItem', async (req, res) => {
  const { name, description, cost, count, category, image } = req.body;
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT add_item($1, $2, $3, $4, $5, $6)',
      [name, description, cost, count, category, image]
    );
    console.log(`New item added with name ${name}`);
    res.status(200).send(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  } finally {
    client.release();
  }
});

//удаление товара
app.post('/delete', async (req, res) => {
  const item_name = req.body.item_name;

  try {
    const query = {
      text: 'DELETE FROM items WHERE name = $1',
      values: [item_name],
    };
    console.log(`Item deleted with name ${item_name}`);

    await pool.query(query);

    res.status(200).json({ message: `Item ${item_name} deleted successfully.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting item.' });
  }
});

//Get-запрос на получение товаров
app.get('/items', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM get_all_items()');
    console.log(rows);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching items');
  }
});

//Get-запрос на получение id заказа
app.get('/order', (req, res) => {
  const userId = req.query.userId;
  pool.query(`SELECT * FROM get_order_by_user_id(${userId})`, (error, result) => {
    if (error) {
      console.error(error);
      res.status(500).send('Error fetching order id');
    } else {
      res.status(200).json(result.rows);
    }
  });
});

//Get-запрос на отображение товаров заказа
app.get('/order-items', (req, res) => {
  const orderId = req.query.orderId;
  pool.query(`SELECT * FROM get_order_items(${orderId})`, (error, result) => {
    if (error) {
      console.error(error);
      res.status(500).send('Error fetching order items');
    } else {
      res.status(200).json(result.rows);
    }
  });
});

app.post('/updateOrderStatus', async (req, res) => {
  const {order_id, order_status} = req.body
  const query = 'select update_order_status($1, $2)';
  const values = [order_id, order_status];
  try{
    await pool.query(query, values);
    console.log('status updated!');
    res.send('status updated');
  }
  catch(error){
    console.log(error);
    res.status(500).send('Error on updating order status');
  }
})

app.post('/getOrderDetails', async (req, res) => {
  const {order_id} = req.body;
  const query = 'select * from get_order_details($1)';
  const values = [order_id];
  try{
    const {rows} = await pool.query(query, values);
    console.log(rows);
    res.json(rows);
  }
  catch(error){
    console.log(error);
    res.status(500).send('Error on getting order detailds');
  }
})

app.post('/getUserOrders', async (req, res) => {
  const {user_id} = req.body;
  const query = 'select * from get_user_orders($1)';
  const values = [user_id];
  try {
    const { rows } = await pool.query(query, values);
    console.log(rows);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching user orders');
  }
})

app.post('/addOrderDetail', (req, res) => {
  const {item_id, order_id, count} = req.body;
  const query = 'select add_detail_to_order($1, $2, $3)';
  const values = [item_id, order_id, count];
  pool.query(query, values).then(
    (result) => {
      console.log(`Item ${item_id} successfully added`);
      res.status(200).send(`Item ${item_id} successfully added`);
    }
  ).catch(
    (error) => {
      console.log(error);
      res.status(500).write("error under adding order detail operation!");
    }
  )
})

app.post('/createOrder', (req,res) => {
  const {point_id, user_id} = req.body;
  const query = 'select create_order($1, $2)';
  const values = [point_id, user_id];
  pool.query(query, values).then(
    (result) => {
      res.status(200).json({
        order_id: result.rows
      })
    }
  ).catch(
    (error) => {
      console.log(error);
      res.status(500).write("error under creating order operation!");
    }
  )
  
});


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});